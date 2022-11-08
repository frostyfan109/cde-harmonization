import { Fragment, useEffect, useMemo, useState } from 'react'
import { Layout, Descriptions, Upload, Button, message, Modal, Space, Input, Typography, Collapse } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { useApp } from './app-context'

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

export const SidePanel = ({ }) => {
  const { analysis, loadAnalysisFile, clearAnalysis } = useApp()

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
    <Sider style={{
      height: '100%',
      background: '#fff',
      padding: '16px 24px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Space direction="vertical" size="large" style={{ width: "100%", overflow: "auto", flexGrow: 1, borderBottom: '1px solid rgba(0, 0, 0, 0.06)' }}>
        <FileInfo />
        <ClusteringInfo />
      </Space>
      {/* <Divider plain style={{ marginBottom: 16 }}>{ fileName ? fileName : 'Please upload a CDE.' }</Divider> */}
      <Button.Group style={{ marginTop: 16, width: "100%" }}>
        <Upload maxCount={ 1 } showUploadList={ false } beforeUpload={ uploadFile } className="upload-cde-button">
          <Button block type="primary" icon={ <UploadOutlined /> }>
            Upload analysis
          </Button>
        </Upload>
        <Button onClick={ clearAnalysis } disabled={ analysis === null }>Clear</Button>
      </Button.Group>
    </Sider>
  )
}