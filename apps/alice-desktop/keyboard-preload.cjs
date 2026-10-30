const {contextBridge,ipcRenderer}=require('electron');
const listen=(channel,callback)=>{const listener=(_event,value)=>callback(value);ipcRenderer.on(channel,listener);return()=>ipcRenderer.removeListener(channel,listener);};
contextBridge.exposeInMainWorld('keyboardDesktop',{
  info:()=>ipcRenderer.invoke('alice:keyboard-info'),
  save:value=>ipcRenderer.invoke('alice:keyboard-save',value),
  exit:mode=>ipcRenderer.invoke('alice:keyboard-exit',mode),
  hit:value=>ipcRenderer.send('alice:keyboard-hit',value),
  drag:value=>ipcRenderer.send('alice:keyboard-drag',value),
  menu:()=>ipcRenderer.invoke('alice:keyboard-menu'),
  farewellDone:token=>ipcRenderer.invoke('alice:farewell-done',token),
  onState:callback=>listen('alice:keyboard-state',callback),
  onPulse:callback=>listen('alice:keyboard-pulse',callback),
  onFarewell:callback=>listen('alice:farewell',callback)
});
