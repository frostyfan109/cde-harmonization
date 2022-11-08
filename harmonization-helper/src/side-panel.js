import { Fragment, useEffect, useMemo, useState } from 'react'
import { Layout, Descriptions, Upload, Button, message, Modal, Space, Input, Typography, Collapse, Spin, List, Empty, Progress, Divider } from 'antd'
import { ProList } from '@ant-design/pro-components'
import { UploadOutlined, DownloadOutlined, DeleteOutlined, RightOutlined, LeftOutlined } from '@ant-design/icons'
import TimeAgo from 'react-timeago'
import { useApp } from './app-context'
import './side-panel.css'

const { Sider } = Layout
const { Panel } = Collapse
const { Title, Text } = Typography

const FileInfo = () => {
  const { analysis } = useApp()
  return (
    <Descriptions title="General" bordered column={ 1 } size="small" style={{ width: "100%" }}>
      <Descriptions.Item label="File name">{ analysis ? analysis.fileName : 'null' }</Descriptions.Item>
      <Descriptions.Item label="CDEs (nodes)">
        { analysis ? analysis.network.nodes.length : 'null' }
      </Descriptions.Item>
      <Descriptions.Item label="Matches (edges)">
        { analysis ? analysis.network.edges.length : 'null' }
      </Descriptions.Item>
      <Descriptions.Item label="Mean score">
        { analysis ? Math.round((analysis.network.edges.reduce((acc, cur) => acc + cur.score, 0) / analysis.network.edges.length) * 100) / 100 : 'null' }
      </Descriptions.Item>
    </Descriptions>
  )
}

const ClusteringInfo = () => {
  const { analysis } = useApp()
  if (!analysis) return null
  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div style={{ marginBottom: -8 }}>
        <span className="ant-descriptions-title">Clustering</span>
      </div>
      <Collapse ghost>
        { Object.values(analysis.communities).map((clusterAlg) => (
          <Panel header={ (
            <div>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{ clusterAlg.name }</span>
            </div>
          ) } key={ clusterAlg.name }>
            <Descriptions bordered column={ 1 } size="small">
              <Descriptions.Item label="Clusters">
                { clusterAlg.clusters.length }
              </Descriptions.Item>
              <Descriptions.Item label={ "Mean cluster size" }>
                { Math.round((clusterAlg.clusters.reduce((acc, cur) => acc + cur.nodes.length, 0) / clusterAlg.clusters.length) * 10) / 10 }
              </Descriptions.Item>
              <Descriptions.Item label={ "Median cluster size" }>
                { (() => {
                  const data = clusterAlg.clusters.map((cluster) => cluster.nodes.length).sort()
                  const medianPoints = (data.length % 2 === 0) ?
                    [data[(data.length / 2) - 1], data[(data.length / 2)]] : 
                    [data[(data.length + 1) / 2 - 1]]
                  return medianPoints.reduce((acc, cur) => acc + cur, 0) / medianPoints.length
                })() }
              </Descriptions.Item>
              {/* <Descriptions.Item label="Mean matches per cluster">
                { Math.round((clusterAlg.clusters.reduce((acc, cur) => acc + cur.edges.length, 0) / clusterAlg.clusters.length) * 10) / 10 }
              </Descriptions.Item> */}
            </Descriptions>
          </Panel>
        )) }
      </Collapse>
    </Space>
  )
}

const CollapseHandle = ({ collapsed, onChange }) => {
  return (
    <Button
      type="default"
      icon={ collapsed ? <RightOutlined /> : <LeftOutlined /> }
      onClick={ () => onChange(!collapsed) }
      style={{
        position: "absolute",
        top: 32,
        right: 0,
        transform: "translate(50%, -50%)",
        backgroundColor: "#fff",
        zIndex: 1000
      }}
    />
  )
}

export const SidePanel = ({ collapsed, setCollapsed }) => {
  const {
    analysis, analysisHistory, loading,
    loadAnalysisFile, clearAnalysis,
    downloadAnalysis, deleteAnalysis,
    setActiveAnalysisKey
  } = useApp()

  const uploadFile = (file) => {
    if (file.name.endsWith('.csv')) {
      // Handles loading analysis CSVs
      const reader = new FileReader()
      reader.onload = () => {
        const csvText = reader.result
        loadAnalysisFile(file.name, csvText)
      }
      reader.readAsBinaryString(file)
    } else {
      message.error('Please upload a CSV file')
    }
  }

  return (
    <Sider className={ `side-panel ${ collapsed ? 'collapsed' : '' }` } style={{
      height: '100%',
      background: '#fff',
      padding: '16px 24px',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>
      <CollapseHandle collapsed={ collapsed } onChange={ setCollapsed } />
      <div style={{
        width: "100%",
        overflow: "auto",
        flexGrow: 1,
        marginBottom: 16,
        borderBottom: "1px solid rgba(0, 0, 0, 0.06)"
      }}>
        {
          analysis ? (
            <Space direction="vertical" size="large">
              <FileInfo />
              <ClusteringInfo />
            </Space>
          ) : (
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              <Text style={{ fontSize: 15, fontWeight: 500 }}>Select a file</Text>
              <ProList
                rowKey="id"
                itemLayout="vertical"
                loading={ loading }
                dataSource={ analysisHistory?.sort((a, b) => b.lastModified - a.lastModified).map((analysis) => ({
                  id: analysis.id,
                  name: analysis.fileName,
                  lastModified: analysis.lastModified,
                  created: analysis.created,
                  progress: Object.values(analysis.communities).map((clusterAlg) => ({
                    name: clusterAlg.name,
                    progress: (clusterAlg.clusters.reduce((acc, cur) => (
                      acc + cur.edges.filter((e) => e.decision !== null).length
                    ), 0) / clusterAlg.clusters.reduce((acc, cur) => (
                      acc + cur.edges.length
                    ), 0)) * 100
                  }))
                })) }
                metas={{
                  title: {
                    dataIndex: "name"
                  },
                  description: {
                    dataIndex: ["lastModified", "progress"],
                    render: (_, { id, lastModified, created, progress }) => (
                      <Space direction="vertical" size="large" style={{ width: "100%" }}>
                        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                          {
                            progress.map(({ name, progress }) => (
                              <div key={ name } style={{ display: "flex", alignItems: "center" }}>
                                <div style={{ color: "#00000073", flexShrink: 0, marginRight: 8 }}>{ name }</div>
                                <Progress percent={ progress } style={{ flexGrow: 1 }} />
                              </div> 
                            ))
                          }
                          <Space style={{ alignItems: "stretch" }}>
                            <div>
                              <div style={{ color: "#00000073" }}>Last modified</div>
                              <div style={{ color: "#000000D9" }}><TimeAgo date={ lastModified } /></div>
                            </div>
                            <Divider type="vertical" style={{ height: "100%" }} />
                            <div>
                              <div style={{ color: "#00000073" }}>Created</div>
                              <div style={{ color: "#000000D9" }}><TimeAgo date={ created } /></div>
                            </div>
                          </Space>
                        </Space>
                        <div style={{ display: "flex" }}>
                          <Button
                            type="primary"
                            style={{ marginRight: 8 }}
                            onClick={ () => setActiveAnalysisKey(id) }
                          >
                            Continue
                          </Button>
                          <Button
                            type="default"
                            icon={ <DownloadOutlined /> }
                            onClick={ () => downloadAnalysis(id) }
                            style={{ marginRight: 8 }}
                          />
                          <Button
                            type="default"
                            danger
                            icon={ <DeleteOutlined /> }
                            onClick={ () => deleteAnalysis(id) }
                          />
                        </div>
                      </Space>
                    )
                  }
                //   content: {
                //     dataIndex: "content",
                //     render: (text) => (
                //         <div style={{ display: "flex", justifyContent: "space-around" }}>
                //             {
                //                 text.map((t) => (
                //                     <div key={ t.label }>
                //                         <div style={{ color: "#00000073" }}>{ t.label }</div>
                //                         <div style={{ color: "#000000D9" }}>
                //                             { t.value }
                //                         </div>
                //                     </div>
                //                 ))
                //             }
                //         </div>
                //     )
                // },
                }}
                locale={{
                  emptyText: <Empty description="Upload a file to begin" />
                }}
                style={{
                  padding: 16,
                  margin: "0 0px"
                }}
                className="file-loader-list"
              />
            </Space>
          )
        }
      </div>
      {/* <Divider plain style={{ marginBottom: 16 }}>{ fileName ? fileName : 'Please upload a CDE.' }</Divider> */}
      <Spin spinning={ loading }>
        <Button.Group style={{ width: "100%", display: collapsed ? "none" : undefined }}>
          <Upload maxCount={ 1 } showUploadList={ false } beforeUpload={ uploadFile } className="upload-cde-button">
            <Button block type="primary" icon={ <UploadOutlined /> }>
              Upload analysis
            </Button>
          </Upload>
          <Button onClick={ clearAnalysis } disabled={ analysis === null }>Close</Button>
        </Button.Group>
      </Spin>
    </Sider>
  )
}