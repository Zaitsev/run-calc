import React from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'
import App from './App'
import {
    AIProvider,
    DisplaySettingsProvider,
    EditorUIProvider,
    StatusProvider,
    ThemeStoreProvider,
    UIStateProvider,
    WindowProvider,
    WorksheetProvider,
} from './contexts'

const container = document.getElementById('root')

const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <StatusProvider>
            <DisplaySettingsProvider>
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
            </DisplaySettingsProvider>
        </StatusProvider>
    </React.StrictMode>
)
