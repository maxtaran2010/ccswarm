import { contextBridge, ipcRenderer } from 'electron'

const api = {
  profiles: {
    list: () => ipcRenderer.invoke('profiles:list'),
    get: (name: string) => ipcRenderer.invoke('profiles:get', name),
    save: (profile: unknown) => ipcRenderer.invoke('profiles:save', profile),
    delete: (name: string) => ipcRenderer.invoke('profiles:delete', name)
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (settings: unknown) => ipcRenderer.invoke('settings:save', settings)
  },
  swarm: {
    launch: () => ipcRenderer.invoke('swarm:launch'),
    stop: () => ipcRenderer.invoke('swarm:stop'),
    status: () => ipcRenderer.invoke('swarm:status')
  },
  shell: {
    openPath: (p: string) => ipcRenderer.invoke('shell:openPath', p)
  }
}

contextBridge.exposeInMainWorld('ccswarm', api)

export type CcswarmApi = typeof api
