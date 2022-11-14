import { useContext, createContext, useState, useMemo, useCallback, useRef, RefObject, useEffect } from 'react'
import { Button, message, Modal, Space, Typography } from 'antd'
import { cyan } from '@ant-design/colors'
import TimeAgo from 'react-timeago'
import Papa from 'papaparse'
import fileDownload from 'js-file-download'
import { v4 as uuid } from 'uuid'
import chroma from 'chroma-js'
import { useLocalStorage } from './use-local-storage'
import { AnalysisCSVMetadataForm } from './csv-metadata-form'
import { AnalysisDict, AnalysisEdge, AnalysisNetwork, ClusterAnalysisNetwork, convertAnalysisDictToNetwork, HarmonizationDecision, InvalidAnalysisDictError } from './converter'
import { db } from './db'
import { connectedComponents, newmanCluster } from './algorithms'
import { Palette, PastelPalette } from './palette'

const { Text, Paragraph } = Typography

export const DEFAULT_HARMONZIATION_FIELDS = [
    "description",
    "label"
]

interface AnalysisFileMetadata {
    nameField: string
    idField: string
    listDelimiter: string
    dictDelimiter: string
    transitiveMatches: boolean
}

interface ClusteringAlgorithm {
    name: string
    description: string
    reference: string
    clusters: ClusterAnalysisNetwork[]
}
interface Communities {
    distinctSubgraphs: ClusteringAlgorithm
    // fastWeightedNewman: ClusteringAlgorithm
}

export interface Analysis {
    id: string,
    created: number,
    lastModified: number,
    fileName: string,
    // raw: AnalysisDict
    network: AnalysisNetwork,
    communities: Communities,
    activeCommunityAlgorithm: string
    metadata: AnalysisFileMetadata
  }

export interface IAppContext {
    harmonizationFields: string[]
    setHarmonizationFields: (fields: string[]) => void
    addHarmonizationField: (field: string) => void
    removeHarmonizationField: (field: string) => void

    analysisHistory: Analysis[] | null
    analysis: Analysis | null

    graphData: { nodes: any[], links: any[] }
    networkRef: RefObject<any>

    loading: boolean

    categoryColors: React.RefObject<{ [category: string]: string }>
    categoryPalette: React.RefObject<Palette>
    
    loadAnalysisFile: (fileName: string, csvText: string) => void
    clearAnalysis: () => void
    downloadAnalysis: (analysis: Analysis | string) => void
    deleteAnalysis: (analysis: Analysis | string) => void
    setActiveAnalysisKey: (key: string | null) => void
    
    updateHarmonizationDecision: (cluster: string, sourceId: string, targetId: string, decision: HarmonizationDecision[] | null) => void
    
    
    activeCommunityAlgorithm: ClusteringAlgorithm | null
    setActiveCommunityAlgorithm: (id: string) => void
    activeCluster: ClusterAnalysisNetwork | null
    setActiveCluster: (id: string | null) => void

    zoomIntoCluster: (id: string) => void
    highlightNodes: Set<string>
    highlightEdge: (edge: AnalysisEdge) => void
    unhighlightEdge: (edge: AnalysisEdge) => void
}

export const AppContext = createContext<IAppContext>({} as IAppContext)
export const AppProvider = ({ children }: any) => {
    const [harmonizationFields, setHarmonizationFields] = useLocalStorage("harmonization-fields", DEFAULT_HARMONZIATION_FIELDS)
    const [activeClusterId, setActiveClusterId] = useState<string|null>(null)
    const [activeAnalysisKey, _setActiveAnalysisKey] = useLocalStorage("active-analysis-key", null)
    const [analysisHistory, setAnalysisHistory] = useState<Analysis[]|null>(null)
    const analysis = useMemo<Analysis|null>(() => (
        analysisHistory?.find((a: Analysis) => a.id === activeAnalysisKey) || null
    ), [analysisHistory, activeAnalysisKey])
    const backupToDelete = useMemo<Analysis|null>(() => (
        analysisHistory && analysisHistory.length >= 10
            ? analysisHistory.sort((a: Analysis, b: Analysis) => a.lastModified - b.lastModified)[0]
            : null
    ), [analysisHistory])

    const highlightNodes = useRef<Set<string>>(new Set())

    const setActiveAnalysisKey = useCallback((key: string | null) => {
        setActiveClusterId(null)
        _setActiveAnalysisKey(key)
    }, [_setActiveAnalysisKey])

    const loading = useMemo(() => analysisHistory === null, [analysisHistory])

    const categoryColors = useRef<{ [category: string]: string }>({})
    const categoryPalette = useRef(new Palette(chroma(cyan[3]), { mode: 'hex' }))

    const addHarmonizationField = useCallback((field: string) => {
        setHarmonizationFields([
            ...harmonizationFields,
            field
        ])
    }, [harmonizationFields])

    const removeHarmonizationField = useCallback((field: string) => {
        setHarmonizationFields([
            ...harmonizationFields.filter((f: string) => f !== field)
        ])
    }, [harmonizationFields])

    const updateAnalysis = useCallback((newAnalysis: Analysis) => {
        setAnalysisHistory([
            ...analysisHistory!.filter((a: Analysis) => a.id !== newAnalysis.id),
            {
                ...newAnalysis,
                lastModified: Date.now()
            }
        ])
        db.table("analyses").update(newAnalysis.id, {
            analysis: JSON.stringify(newAnalysis)
        })
    }, [analysisHistory, setAnalysisHistory])

    const addAnalysis = useCallback((newAnalysis: Analysis) => {
        setAnalysisHistory([
            ...analysisHistory!,
            // ...analysisHistory!.filter((analysis: Analysis) => analysis.id !== backupToDelete?.id),
            newAnalysis
        ])
        setActiveAnalysisKey(newAnalysis.id)
        db.table("analyses").put({
            id: newAnalysis.id,
            analysis: JSON.stringify(newAnalysis)
        })
    }, [analysisHistory, setAnalysisHistory, setActiveAnalysisKey, backupToDelete])


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
    }, [analysis?.network])

    const activeCommunityAlgorithm = useMemo<ClusteringAlgorithm|null>(() => (
        analysis
            ? Object.entries(analysis.communities).find(([id, alg]) => id === analysis.activeCommunityAlgorithm)![1]
            : null
    ), [analysis])
    const setActiveCommunityAlgorithm = useCallback((id: string) => {
        if (analysis) {
            setActiveClusterId(null)
            updateAnalysis({
                ...analysis,
                activeCommunityAlgorithm: id
            })
        }
    }, [analysis, updateAnalysis])
    const activeCluster = useMemo<ClusterAnalysisNetwork|null>(() => (
        activeClusterId
            ? activeCommunityAlgorithm!.clusters.find((c) => c.id === activeClusterId)!
            : null
    ), [activeClusterId, activeCommunityAlgorithm])

    const getAnalysisCSVMetaData = (onOk: (form: AnalysisFileMetadata) => void, onCancel: () => void) => {
        let form: AnalysisFileMetadata

        const onChange = (value: AnalysisFileMetadata) => {
            form = value
        }

        Modal.warning({
            title: "Some additional info is required to load this file",
            okCancel: true,
            okText: "Confirm",
            cancelText: "Cancel",
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

    const clearAnalysis = useCallback(() => {
        setActiveAnalysisKey(null)
        // backupClearWarning(() => setActiveAnalysisKey(null))
    }, [setActiveAnalysisKey])

    const downloadAnalysis = useCallback((analysis: Analysis | string) => {
        if (typeof analysis === "string") analysis = analysisHistory!.find((a) => a.id === analysis)!
        fileDownload(JSON.stringify(analysis), analysis.fileName + "-harmonization.json")
    }, [analysisHistory])

    const deleteAnalysis = useCallback((analysis: Analysis | string) => {
        if (typeof analysis === "string") analysis = analysisHistory!.find((a) => a.id === analysis)!
        setAnalysisHistory(analysisHistory!.filter((a) => a.id !== (analysis as Analysis).id))
        if (activeAnalysisKey === analysis.id) clearAnalysis()
        db.table("analyses").delete(analysis.id)
    }, [analysisHistory, activeAnalysisKey, clearAnalysis])

    const updateHarmonizationDecision = useCallback((
        clusterId: string,
        sourceId: string,
        targetId: string,
        decision: HarmonizationDecision[] | null
    ) => {
        if (analysis && activeCommunityAlgorithm) {
            // const cluster = activeCommunityAlgorithm.clusters.find((c) => c.id === clusterId)!
            // const edge = cluster.edges.find((e) => e.source === sourceId && e.target === targetId)!
            updateAnalysis({
                ...analysis,
                communities: {
                    ...analysis.communities,
                    [analysis.activeCommunityAlgorithm]: {
                        ...activeCommunityAlgorithm,
                        clusters: activeCommunityAlgorithm.clusters.map((cluster) => {
                            if (cluster.id === clusterId) {
                                cluster.edges = cluster.edges.map((e) => {
                                    if (e.source === sourceId && e.target === targetId) e.decision = decision
                                    return e
                                })
                            }
                            return cluster
                        })
                    }
                }
            })
        }
    }, [analysis, activeCommunityAlgorithm, updateAnalysis])

    const backupDeleteWarning = useCallback((onOk: () => void) => {
        if (backupToDelete) {
            Modal.confirm({
                title: "Loading this file will delete an older backup",
                content: (
                    <Space direction="vertical" size="small">
                        <Paragraph>
                            Due to storage restrictions, only the five most recent files are automatically backed up locally.
                            <br/><br/>
                            If you load a new file, you will lose your backup for the following file:
                            <pre>{ backupToDelete.fileName }</pre>
                            <small>Last modified: <TimeAgo date={ backupToDelete.lastModified } /></small>
                        </Paragraph>
                        <Button type="primary" onClick={ () => downloadAnalysis(backupToDelete) }>Download file</Button>
                    </Space>
                ),  
                okText: "Proceed",
                cancelText: "Cancel",
                onOk
            })
        } else onOk()
    }, [backupToDelete])

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
                const { nameField, idField, listDelimiter, dictDelimiter, transitiveMatches } = metadata
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
                    // backupDeleteWarning(() => (
                    addAnalysis({
                        id: `${ fileName }-${ Date.now() }-${ uuid  () }`,
                        created: Date.now(),
                        lastModified: Date.now(),
                        // raw: analysisDict,
                        communities: {
                            distinctSubgraphs: {
                                name: "Distinct subgraphs",
                                description: "The subgraphs (connected components) of the network",
                                reference: "https://en.wikipedia.org/wiki/Component_(graph_theory)",
                                clusters: connectedComponents(network, idField).map((cluster) => {
                                    if (transitiveMatches) {
                                        cluster.edges = cluster.nodes.reduce<any>((acc, n1) => {
                                            cluster.nodes.forEach((n2) => {
                                                if (n1.id === n2.id) return
                                                const exists = !!acc.find((e: any) => (
                                                    (e.source === n1.id && e.target === n2.id) ||
                                                    (e.source === n2.id && e.target === n1.id)
                                                ))
                                                if (!exists) acc.push({
                                                    source: n1.id,
                                                    target: n2.id,
                                                    decision: null
                                                })
                                            })
                                            return acc
                                        }, [])
                                    }
                                    return cluster
                                })
                            },
                            // fastWeightedNewman: {
                            //     name: "Fast Newman with Weights",
                            //     description: "Fast Newman community detection accelerated by Clauset et al. with weightings",
                            //     reference: "http://scaledinnovation.com/analytics/communities/communities.html",
                            //     clusters: newmanCluster(network, idField)
                            // }
                        },
                        activeCommunityAlgorithm: "distinctSubgraphs",
                        network,
                        metadata,
                        fileName
                    })
                    // ))
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
                }
            },
            () => {
                // Cancelled
            }
        )
    }

    const zoomIntoCluster = useCallback((id: string) => {
        if (analysis && networkRef.current) {
            const padding = 32
            const idField = analysis.metadata.idField
            const nodeIds = activeCommunityAlgorithm!.clusters.find((c) => c.id === id)!.nodes.map((n) => n.id)
            const nodes = graphData.nodes.filter((n) => nodeIds.includes(n[idField]))
            const x = nodes.reduce((acc, cur) => acc + cur.x, 0) / nodes.length
            const y = nodes.reduce((acc, cur) => acc + cur.y, 0) / nodes.length
            // networkRef.current.centerAt(x, y, 500)
            // networkRef.current.zoom(5, 500)
            networkRef.current.zoomToFit(500, 256, (node: any) => nodeIds.includes(node[idField]))
        }
    }, [analysis, activeCommunityAlgorithm, graphData])

    const highlightEdge = useCallback((edge: AnalysisEdge) => {
        highlightNodes.current.add(edge.source)
        highlightNodes.current.add(edge.target)
    }, [])
    const unhighlightEdge = useCallback((edge: AnalysisEdge) => {
        highlightNodes.current.delete(edge.source)
        highlightNodes.current.delete(edge.target)
    }, [])

    useEffect(() => {
        if (activeClusterId) zoomIntoCluster(activeClusterId)
    }, [activeClusterId, zoomIntoCluster])

    useEffect(() => {
        (async () => {
            /* @ts-ignore */
            const records = await db.table("analyses").toArray()
            setAnalysisHistory(records.map((record) => JSON.parse(record.analysis)))
        })()
    }, [])

    return (
        <AppContext.Provider value={{
            harmonizationFields, setHarmonizationFields, addHarmonizationField, removeHarmonizationField,

            analysisHistory, analysis, setActiveAnalysisKey,
            
            graphData, networkRef,

            categoryPalette, categoryColors,

            loading,
            
            loadAnalysisFile, clearAnalysis, downloadAnalysis, deleteAnalysis,
            activeCommunityAlgorithm, setActiveCommunityAlgorithm,
            activeCluster, setActiveCluster: setActiveClusterId,

            updateHarmonizationDecision,

            zoomIntoCluster,
            highlightEdge, unhighlightEdge,
            highlightNodes: highlightNodes.current
        }}>
            { children }
        </AppContext.Provider>
    )
}
export const useApp = () => useContext(AppContext)