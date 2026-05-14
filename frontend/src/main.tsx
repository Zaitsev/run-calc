import React from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'
import App from './App'
import {
    AIProvider,
    DisplaySettingsProvider,
    EditorUIProvider,
    StatusProvider,
    ThemeProvider,
    ThemeStoreProvider,
    UIStateProvider,
    WindowProvider,
    WorksheetManagerProvider,
    WorksheetProvider,
} from './contexts'

const container = document.getElementById('root')

const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <ThemeProvider>
            <StatusProvider>
                <DisplaySettingsProvider>
                    <WorksheetManagerProvider>
                        <WorksheetProvider>
                            <EditorUIProvider>
                                <UIStateProvider>
                                    <WindowProvider>
                                        <AIProvider>
                                            <ThemeStoreProvider>
                                                <App/>
                                            </ThemeStoreProvider>
                                        </AIProvider>
                                    </WindowProvider>
                                </UIStateProvider>
                            </EditorUIProvider>
                        </WorksheetProvider>
                    </WorksheetManagerProvider>
                </DisplaySettingsProvider>
            </StatusProvider>
        </ThemeProvider>
    </React.StrictMode>
)
