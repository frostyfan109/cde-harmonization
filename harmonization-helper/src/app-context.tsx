import { useContext, createContext, useState, useMemo, useCallback, useRef, RefObject } from 'react'
import { message, Modal, Space, Typography } from 'antd'
import Papa from 'papaparse'
import { AnalysisCSVMetadataForm } from './csv-metadata-form'
import { AnalysisDict, AnalysisNetwork, convertAnalysisDictToNetwork, InvalidAnalysisDictError } from './converter'
import { connectedComponents, newmanCluster } from './algorithms'

const { Text, Paragraph } = Typography

interface AnalysisFileMetadata {
    idField: string
    listDelimiter: string
    dictDelimiter: string
}

interface ClusteringAlgorithm {
    name: string
    description: string
    reference: string
    clusters: AnalysisNetwork[]
}
interface Communities {
    distinctSubgraphs: ClusteringAlgorithm
    fastWeightedNewman: ClusteringAlgorithm
}

export interface Analysis {
    fileName: string,
    raw: AnalysisDict
    network: AnalysisNetwork,
    communities: Communities,
    activeCommunityAlgorithm: string
    metadata: AnalysisFileMetadata
  }

export interface IAppContext {
    analysis: Analysis | null,

    graphData: { nodes: any[], links: any[] }
    networkRef: RefObject<any>
    
    loadAnalysisFile: (fileName: string, csvText: string) => void
    clearAnalysis: () => void,

    activeCommunityAlgorithm: ClusteringAlgorithm | null,
    setActiveCommunityAlgorithm: (id: string) => void,

    zoomIntoCluster: (index: number) => void
}

export const AppContext = createContext<IAppContext>({} as IAppContext)
export const AppProvider = ({ children }: any) => {
    const [analysis, setAnalysis] = useState<Analysis|null>(null)

    const networkRef = useRef<any>()

    const graphData = useMemo(() => {
        if (analysis) {
            const net = {
                nodes: analysis.network.nodes.map((node) => ({
                    ...node
                })),
                links: analysis.network.edges.map((edge) => ({
                    ...edge
                }))
            }
            return net
        } else return {
            nodes: [],
            links: []
        }
    }, [analysis])

    const activeCommunityAlgorithm = useMemo<ClusteringAlgorithm|null>(() => (
        analysis
            ? Object.entries(analysis.communities).find(([id, alg]) => id === analysis.activeCommunityAlgorithm)![1]
            : null
    ), [analysis])
    const setActiveCommunityAlgorithm = useCallback((id: string) => analysis ? setAnalysis({
        ...analysis,
        activeCommunityAlgorithm: id
    }) : {}, [analysis])
    

    const getAnalysisCSVMetaData = (onOk: (form: AnalysisFileMetadata) => void, onCancel: () => void) => {
        let form: AnalysisFileMetadata

        const onChange = (value: AnalysisFileMetadata) => {
            form = value
        }

        Modal.warning({
            title: "Some additional info is required to load this file",
            okCancel: true,
            okText: "Confirm",
            content: (
                <div style={{ marginTop: 16 }}>
                    <div style={{ marginBottom: 16 }}>Note: The default values should work for standard files.</div>

                    <AnalysisCSVMetadataForm
                    onChange={ onChange }
                    />
                </div>
            ),
            onOk: () => onOk(form),
            onCancel: () => onCancel()
        })
    }

    const clearAnalysis = () => setAnalysis(null)

    const loadAnalysisFile = (fileName: string, csvText: string): void => {
        const { data, errors } = Papa.parse(csvText)
        const [header, ...rows] = data as string[][]
        const cdeJson = rows.map((row) => {
            return header.reduce((acc: any, columnName: string, i) => {
                acc[columnName] = row[i]
                return acc
            }, {})
        })
        getAnalysisCSVMetaData(
            (metadata: AnalysisFileMetadata) => {
                const { idField, listDelimiter, dictDelimiter } = metadata
                const analysisDict = cdeJson
                    .map((row) => {
                        row.categories = row.categories?.split(listDelimiter)
                        row.matches = Object.fromEntries(
                            row.matches?.split(dictDelimiter).map((entry: string) => entry.split(listDelimiter)) || []
                        )
                        return row
                    })
                try {
                    const network = convertAnalysisDictToNetwork(analysisDict, idField)
                    
                    setAnalysis({
                        raw: analysisDict,
                        communities: {
                            distinctSubgraphs: {
                                name: "Distinct subgraphs",
                                description: "The subgraphs (connected components) of the network",
                                reference: "https://en.wikipedia.org/wiki/Component_(graph_theory)",
                                clusters: connectedComponents(network, idField)
                            },
                            fastWeightedNewman: {
                                name: "Fast Newman with Weights",
                                description: "Fast Newman community detection accelerated by Clauset et al. with weightings",
                                reference: "http://scaledinnovation.com/analytics/communities/communities.html",
                                clusters: newmanCluster(network, idField)
                            }
                        },
                        activeCommunityAlgorithm: "distinctSubgraphs",
                        network,
                        metadata,
                        fileName
                    })
                } catch (e: any) {
                    Modal.error({
                        title: "Invalid or misconfigured analysis file",
                        content: (
                            <Space direction="vertical" style={{ width: "100%" }}>
                                <Text>Make sure you've configured the loading options properly.</Text>
                                <Paragraph style={{ fontFamily: "monospace", whiteSpace: "pre-line", unicodeBidi: "embed" }} ellipsis={{
                                    rows: 3,
                                    expandable: true,
                                    
                                }}>
                                    { e.stack }
                                    <br />
                                </Paragraph>
                            </Space>
                        )
                    })
                    setAnalysis(null)
                }
            },
            () => {
                // Cancelled
                setAnalysis(null)
            }
        )
    }

    const zoomIntoCluster = useCallback((index: number) => {
        if (analysis) {
            const padding = 32
            const idField = analysis.metadata.idField
            const nodeIds = activeCommunityAlgorithm!.clusters[index].nodes.map((n) => n[idField])
            const nodes = graphData.nodes.filter((n) => nodeIds.includes(n[idField]))
            const x = nodes.reduce((acc, cur) => acc + cur.x, 0) / nodes.length
            const y = nodes.reduce((acc, cur) => acc + cur.y, 0) / nodes.length
            networkRef.current.centerAt(x, y, 500)
            networkRef.current.zoom(5, 500)
        }
    }, [analysis, activeCommunityAlgorithm, graphData])
    return (
        <AppContext.Provider value={{
            analysis,
            
            graphData, networkRef,
            
            loadAnalysisFile, clearAnalysis,
            activeCommunityAlgorithm, setActiveCommunityAlgorithm,

            zoomIntoCluster
        }}>
            { children }
        </AppContext.Provider>
    )
}
export const useApp = () => useContext(AppContext)