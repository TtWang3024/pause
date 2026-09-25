// Experiments never grant allowances or end required breaks. Each record has its
// own storage key, so separate tabs cannot overwrite one another's history.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!['experimentLaunch','experimentLeave','experimentResume'].includes(msg?.type)) return;
  (async () => {
    if (!sender.tab?.id) throw new Error('A tab is required');
    const tabId=sender.tab.id;
    if (msg.type==='experimentResume') {
      const key='experimentResume:'+tabId;
      const data=(await chrome.storage.local.get(key))[key];
      if (data && data.url===sender.url) {
        await chrome.storage.local.remove(key);
        return {ok:true, playback:Date.now()-data.ts<86400000 ? data.playback : null};
      }
      return {ok:true};
    }
    if (msg.type==='experimentLaunch') {
      const source=new URL(sender.url || sender.tab.url);
      const extension=source.protocol==='chrome-extension:' && source.host===chrome.runtime.id;
      const page=source.pathname.split('/').pop();
      if (extension && !['reflect.html','break.html','pause.html'].includes(page)) throw new Error('Invalid entry');
      if (!extension && !['http:','https:'].includes(source.protocol)) throw new Error('Invalid entry');
      const target=extension ? source.searchParams.get('url') || '' : source.href;
      if (target && !/^https?:\/\//.test(target)) throw new Error('Invalid target');
      const settings=await getSettings();
      const group=target ? findGroupForUrl(target,settings.groups) : null;
      if(!extension && !group) throw new Error('Not a watched site');
      const id=crypto.randomUUID();
      const playback=msg.playback && Number.isFinite(msg.playback.time) && msg.playback.time>=0
        ? {time:msg.playback.time, index:Math.max(0,Math.min(100,Math.floor(msg.playback.index)||0))} : null;
      const record={id,createdAt:Date.now(),phase:'setup',targetUrl:target,returnUrl:source.href,groupId:group?.id || source.searchParams.get('group') || '',context:extension ? page==='break.html'?'At a session break':'Before opening':'While watching',playback};
      await chrome.storage.local.set({['experiment:'+id]:record});
      await chrome.tabs.update(tabId,{url:chrome.runtime.getURL('experiment.html')+'?id='+encodeURIComponent(id)});
      return {ok:true};
    }
    const source=new URL(sender.url || sender.tab.url);
    if((source.protocol!=='chrome-extension:' || source.host!==chrome.runtime.id) || source.pathname!=='/experiment.html' || source.searchParams.get('id')!==msg.id) throw new Error('Invalid experiment');
    if(!['return','finish','cancelled'].includes(msg.nextChoice)) throw new Error('Invalid choice');
    const key='experiment:'+msg.id;
    const record=(await chrome.storage.local.get(key))[key];
    if(!record) throw new Error('Missing experiment');
    record.phase='done';record.nextChoice=msg.nextChoice;record.completedAt=Date.now();
    await chrome.storage.local.set({[key]:record});
    if(msg.nextChoice==='finish') {
      await chrome.tabs.remove(tabId);
    } else {
      let url=record.returnUrl;
      if(msg.nextChoice==='return' && record.targetUrl) {
        const settings=await getSettings();
        const group=findGroupForUrl(record.targetUrl,settings.groups);
        const state=group && await getGroupState(group.id);
        const now=Date.now();
        url=record.targetUrl;
        if(group && scheduleActiveNow(group.schedule) && !(await snoozeUntil())) {
          if(state && now<state.allowanceEnd) url=record.targetUrl;
          else if(state && now<state.breakEnd) url=breakUrl(record.targetUrl,group.id,state);
          else url=entryUrl(record.targetUrl,group.id,settings.magicStars!==false);
        }
      }
      if(record.playback) await chrome.storage.local.set({['experimentResume:'+tabId]:{url:record.targetUrl,playback:record.playback,ts:Date.now()}});
      await chrome.tabs.update(tabId,{url});
    }
    return {ok:true};
  })().then(sendResponse).catch(() => sendResponse({ok:false}));
  return true;
});
