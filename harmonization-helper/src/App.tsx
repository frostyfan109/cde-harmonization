import React, { useState } from 'react';
import { Typography, Layout, Descriptions, Upload, Button } from 'antd'
import { Allotment } from 'allotment'
import { AppProvider } from './app-context';
import { SidePanel } from './side-panel';
import { NetworkGraph } from './network-graph';
import { HarmonizationPanel } from './harmonization-panel';
import './App.css';
import 'allotment/dist/style.css'
import 'antd/dist/antd.css'

const { Title, Text } = Typography
const { Header, Content, Sider } = Layout
const { Pane } = Allotment

function App() {
  return (
    <div className="App" style={{ display: 'flex', flexDirection: 'column' }}>
      <AppProvider>
        <Layout>
          <Header className="header" style={{
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            padding: '0 48px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)'
          }}>
            <Title level={ 4 } style={{ marginTop: 8, marginBottom: 8 }}>
              Harmonization Assistant
            </Title>
          </Header>
          <Layout style={{ position: 'relative' }}>
            <Allotment>
              <Pane minSize={ 300 } preferredSize={ 300 }>
                <SidePanel />
              </Pane>
              <Pane>
                <Content style={{ height: '100%' }}>
                  <NetworkGraph />
                </Content>
              </Pane>
              <Pane minSize={ 500 } preferredSize={ 500 }>
                <HarmonizationPanel />
              </Pane>
            </Allotment>
          </Layout>
        </Layout>
      </AppProvider>
    </div>
  );
}

export default App;
