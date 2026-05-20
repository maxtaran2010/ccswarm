import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { ProfileStore } from './profileStore'
import { SettingsStore } from './settingsStore'
import { WorkspaceManager } from './workspaceManager'
import { ITermDriver } from './itermDriver'
import { SwarmController } from './swarmController'
import { AgentProfileSchema, SettingsSchema } from './types'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
let profileStore: ProfileStore
let settingsStore: SettingsStore
let workspaceManager: WorkspaceManager
let driver: ITermDriver
let controller: SwarmController

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('profiles:list', async () => profileStore.list())
  ipcMain.handle('profiles:get', async (_e, name: string) => profileStore.get(name))
  ipcMain.handle('profiles:save', async (_e, raw: unknown) => {
    const parsed = AgentProfileSchema.parse(raw)
    return profileStore.save(parsed)
  })
  ipcMain.handle('profiles:delete', async (_e, name: string) => profileStore.delete(name))

  ipcMain.handle('settings:load', async () => settingsStore.load())
  ipcMain.handle('settings:save', async (_e, raw: unknown) => {
    const parsed = SettingsSchema.parse(raw)
    return settingsStore.save(parsed)
  })

  ipcMain.handle('swarm:launch', async (_e, profileNames: string[]) =>
    controller.launch(profileNames)
  )
  ipcMain.handle('swarm:stop', async () => controller.stop())
  ipcMain.handle('swarm:status', async () => controller.current())

  ipcMain.handle('shell:openPath', async (_e, p: string) => shell.openPath(p))
}

app.whenReady().then(async () => {
  profileStore = new ProfileStore()
  settingsStore = new SettingsStore()
  workspaceManager = new WorkspaceManager()
  await profileStore.init()
  await settingsStore.init()

  const settings = settingsStore.current()
  driver = new ITermDriver(settings.pythonPath)
  controller = new SwarmController(profileStore, settingsStore, workspaceManager, driver)

  registerIpc()
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  try {
    await controller?.stop()
    await driver?.stop()
  } catch {
    /* ignore */
  }
  if (process.platform !== 'darwin') app.quit()
})
