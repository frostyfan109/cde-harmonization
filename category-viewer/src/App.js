import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Descriptions, Divider, Empty, Layout, message, Space, Spin, Typography, Upload, Slider, Menu, Select, List } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import Papa from 'papaparse'
import NetworkGraph from 'react-vis-network-graph'
import { cdeToNetwork } from './kgx-loader'
import './App.css'
import 'antd/dist/antd.css'

const { Title, Text } = Typography
const { Header, Sider, Content } = Layout
const { Option } = Select

function App() {
  const [fileName, setFileName] = useState(null)
  const [cde, setCde] = useState(null)
  const [selectedCategories, setSelectedCategories] = useState([])

  const graph = useMemo(() => {
    if (!cde) return null
    const net = cdeToNetwork(cde)
    return net
  }, [cde])

  const outDegree = useCallback((node) => graph.edges.filter((e) => e.from === node.id).length, [graph])
  const inDegree = useCallback((node) => graph.edges.filter((e) => e.to === node.id).length, [graph])
  const degree = useCallback((node) => inDegree(node) + outDegree(node), [graph, inDegree, outDegree])

  const permissibleCategories = useMemo(() => (
    selectedCategories.flatMap((categoryId) => {
      const outNodes = graph.edges.filter((e) => e.from === categoryId).map((e) => e.to)
      const oneHopConnectedCategories = graph.edges.filter((e) => outNodes.includes(e.to)).map((e) => e.from)
      return [categoryId, ...oneHopConnectedCategories]
    })
  ), [graph, selectedCategories])
  console.log(permissibleCategories)
  const filteredGraph = useMemo(() => {
    if (!graph) return null
    const net = {
      nodes: graph.nodes.map((n) => ({ ...n })),
      edges: graph.edges.map((e) => ({ ...e }))
    }
    selectedCategories.forEach((category) => {
      const n = net.nodes.find((n) => n.id === category)
      n.color = '#ff0000'
      n.size *= 2
    })
    net.nodes = net.nodes.filter((node) => node.type !== 'category' || selectedCategories.includes(node.id))
    net.nodes = net.nodes.filter((node) => {
      if (node.type === 'category') return true
      return selectedCategories.every((category) => !!net.edges.find((e) => e.from === category && e.to === node.id))
      // const isConnectedToSelectedCategory = net.edges.filter((e) => selectedCategories.includes(e.from) && e.to === node.id).length > 0
      // return isConnectedToSelectedCategory
    })
    // Remove edges referencing pruned nodes
    net.edges = net.edges.filter((edge) => (
        net.nodes.find((n) => edge.from === n.id) &&
        net.nodes.find((n) => edge.to === n.id)
    ))
    // Remove nodes with no edges
    net.nodes = net.nodes.filter((node) => (
        net.edges.filter((e) => e.from === node.id || e.to === node.id).length > 0
    ))
    console.log(`Loading graph with ${net.nodes.length} nodes and ${net.edges.length} edges`)
    return net
  }, [graph, selectedCategories, permissibleCategories])

  const [categoryNodes, fieldNodes] = useMemo(() => (
    graph ? [
      graph.nodes.filter((n) => n.type === 'category'),
      graph.nodes.filter((n) => n.type === 'field')
     ] : [null, null]
  ), [graph])
  const [filteredCategoryNodes, filteredFieldNodes] = useMemo(() => (
    filteredGraph ? [
      filteredGraph.nodes.filter((n) => n.type === 'category'),
      filteredGraph.nodes.filter((n) => n.type === 'field')
    ] : [null, null]
  ), [filteredGraph])

  const options = useMemo(() => (categoryNodes ?
    categoryNodes
      .sort((a, b) => outDegree(b) - outDegree(a))
      .map((node) => ({
        key: node.id,
        value: node.id,
        label: `${ node.id } (${ outDegree(node) })`
      })) : null
  ), [categoryNodes, inDegree, outDegree])

  const uploadFile = (file) => {
    if (file.name.endsWith('.csv')) {
      setFileName(file.name)
      const reader = new FileReader()
      reader.onload = () => {
        const csvText = reader.result
        const { data, errors } = Papa.parse(csvText)
        const [header, ...rows] = data
        const cdeJson = rows.map((row) => {
          return header.reduce((acc, columnName, i) => {
            acc[columnName] = row[i]
            return acc
          }, {})
        })
        setCde(cdeJson)
      }
      reader.readAsBinaryString(file)
    } else {
      message.error('Please upload a CSV file')
      setFileName(null)
    }
  }

  return (
    <div className="App" style={{ display: 'flex', flexDirection: 'column' }}>
      <Layout bordered>
        <Header className="header" style={{
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          padding: '0 48px',
          borderBottom: '1px solid rgba(0, 0, 0, 0.06)'
        }}>
          <Title level={ 4 } style={{ marginBottom: 0 }} style={{ marginTop: 8, marginBottom: 8 }}>
            CDE Grouping Visualizer
          </Title>
        </Header>
        <Layout>
          <Sider width={ 350 } style={{ background: '#fff', padding: '16px 24px', borderRight: '1px solid rgba(0, 0, 0, 0.06)' }}>
            <Descriptions title="File info" bordered column={ 1 } size="small" style={{ width: '100%' }}>
              <Descriptions.Item label="Name">{ fileName ? fileName : 'null' }</Descriptions.Item>
              <Descriptions.Item label="Fields">
                { fieldNodes ? `${filteredFieldNodes.length} (${fieldNodes.length})` : 'null' }
              </Descriptions.Item>
              <Descriptions.Item label="Categories">
                { categoryNodes ? `${filteredCategoryNodes.length} (${categoryNodes.length})` : 'null' }
              </Descriptions.Item>
            </Descriptions>
            {/* <Divider plain style={{ marginBottom: 16 }}>{ fileName ? fileName : 'Please upload a CDE.' }</Divider> */}
            <Upload maxCount={ 1 } showUploadList={ false } beforeUpload={ uploadFile } className="upload-cde-button">
              <Button block type="primary" icon={ <UploadOutlined /> }>
                Upload CDE
              </Button>
            </Upload>
          </Sider>
          <Content>
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              { graph && selectedCategories.length > 0 ? (
                <Fragment>
                  <NetworkGraph
                    graph={ filteredGraph }
                    options={{
                      interaction: { hover: true },
                      layout: {
                        randomSeed: 1,
                        improvedLayout: true
                      },
                      nodes: {
                        shape: 'dot',
                        scaling: {
                          min: 10,
                          max: 30
                        },
                        font: {
                          size: 12,
                          face: 'Tahoma'
                        }
                      },
                      edges: {
                        width: 0.15,
                        color: { inherit: 'from' },
                        smooth: {
                          type: 'continuous'
                        }
                      },
                      physics: {
                        stabilization: false,
                        barnesHut: {
                          gravitationalConstant: -80000,
                          springConstant: 0.001,
                          springLength: 200
                        }
                      },
                      interaction: {
                        tooltipDelay: 50,
                        hideEdgesOnDrag: true
                      },
                      width: '100%',
                      height: '100%'
                    }}
                    style={{ flexGrow: 1 }}
                  />
                  <div className="graph-controls" style={{ background: '#fff', width: '100%', padding: 24 }}>
                    {/* <div style={{ display: 'flex', width: '100%' }}>
                      <Text>Show top n categories</Text>
                      <Slider value={ showCategoryCount }  />
                    </div> */}
                  </div>
                </Fragment>
              ) : (
                <Empty style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }} />
              )}
            </div>
          </Content>
          <Sider width={ 300 } style={{ background: '#fff', padding: '24px', borderLeft: '1px solid rgba(0, 0, 0, 0.06)' }}>
            <Title level={ 5 } style={{ fontWeight: 500, marginBottom: 24 }}>
              Select a category to view
            </Title>
            { categoryNodes ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>Category</Text>
                <Select
                  showSearch
                  placeholder="Select a category to view"
                  mode="multiple"
                  options={ options }
                  onChange={ setSelectedCategories }
                  style={{ width: '100%' }}
                />
              </Space>
            ) : fileName ? (
              <Spin style={{ padding: 64, display: 'flex', justifyContent: 'center', alignItems: 'center' }} />
            ) : (
              <Empty image={ Empty.PRESENTED_IMAGE_SIMPLE } description="You need to upload a CDE first" />
            ) }
          </Sider>
        </Layout>
      </Layout>
    </div>
  );
}

export default App;
