const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // 오버레이용
  onClickTrail: (cb) => ipcRenderer.on("click-trail", (_, d) => cb(d)),
  onBeacon: (cb) => ipcRenderer.on("beacon", (_, d) => cb(d)),
  onTeleportBeacon: (cb) => ipcRenderer.on("teleport-beacon", (_, d) => cb(d)),
  onRippleStart: (cb) => ipcRenderer.on("ripple-start", (_, d) => cb(d)),
  onRippleStop: (cb) => ipcRenderer.on("ripple-stop", (_, d) => cb(d)),

  // 캐릭터용
  onKeyTyped: (cb) => ipcRenderer.on("key-typed", (_, d) => cb(d)),

  // 설정
  getConfig: () => ipcRenderer.invoke("get-config"),
});
