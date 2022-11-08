import { useContext, createContext, useState, useMemo, useCallback, useRef, RefObject, useEffect } from 'react'
import { Button, message, Modal, Space, Typography } from 'antd'
import TimeAgo from 'react-timeago'
import Papa from 'papaparse'
import fileDownload from 'js-file-download'
import { v4 as uuid } from 'uuid'
import { useLocalStorage } from './use-local-storage'
import { AnalysisCSVMetadataForm } from './csv-metadata-form'
import { AnalysisDict, AnalysisNetwork, ClusterAnalysisNetwork, convertAnalysisDictToNetwork, InvalidAnalysisDictError } from './converter'
import { db } from './db'
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
    addHarmonizationField: (field: string) => void
    removeHarmonizationField: (field: string) => void

    analysisHistory: Analysis[] | null
    analysis: Analysis | null

    graphData: { nodes: any[], links: any[] }
    networkRef: RefObject<any>

    loading: boolean
    
    loadAnalysisFile: (fileName: string, csvText: string) => void
    clearAnalysis: () => void
    downloadAnalysis: (analysis: Analysis|string) => void
    deleteAnalysis: (analysis: Analysis|string) => void
    setActiveAnalysisKey: (key: string | null) => void


    activeCommunityAlgorithm: ClusteringAlgorithm | null,
    setActiveCommunityAlgorithm: (id: string) => void,

    zoomIntoCluster: (id: string) => void
}

export const AppContext = createContext<IAppContext>({} as IAppContext)
export const AppProvider = ({ children }: any) => {
    const [harmonizationFields, setHarmonizationFields] = useLocalStorage("harmonization-fields", [
        "variable_name",
        "description",
        "label",
    ])
    const [activeAnalysisKey, setActiveAnalysisKey] = useLocalStorage("active-analysis-key", null)
    const [analysisHistory, setAnalysisHistory] = useState<Analysis[]|null>(null)
    const analysis = useMemo<Analysis|null>(() => analysisHistory?.find((a: Analysis) => a.id === activeAnalysisKey) || null, [analysisHistory, activeAnalysisKey])
    const backupToDelete = useMemo<Analysis|null>(() => (
        analysisHistory && analysisHistory.length >= 10
            ? analysisHistory.sort((a: Analysis, b: Analysis) => a.lastModified - b.lastModified)[0]
            : null
    ), [analysisHistory])

    const loading = useMemo(() => analysisHistory === null, [analysisHistory])

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
        db.table("analyses").update(newAnalysis.id, newAnalysis)
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
    const setActiveCommunityAlgorithm = useCallback((id: string) => analysis ? updateAnalysis({
        ...analysis,
        activeCommunityAlgorithm: id
    }) : {}, [analysis, updateAnalysis])
    

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
                                clusters: connectedComponents(network, idField)
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
        if (analysis) {
            const padding = 32
            const idField = analysis.metadata.idField
            const nodeIds = activeCommunityAlgorithm!.clusters.find((c) => c.id === id)!.nodes.map((n) => n.id)
            const nodes = graphData.nodes.filter((n) => nodeIds.includes(n[idField]))
            const x = nodes.reduce((acc, cur) => acc + cur.x, 0) / nodes.length
            const y = nodes.reduce((acc, cur) => acc + cur.y, 0) / nodes.length
            networkRef.current.centerAt(x, y, 500)
            networkRef.current.zoom(5, 500)
        }
    }, [analysis, activeCommunityAlgorithm, graphData])

    useEffect(() => {
        (async () => {
            /* @ts-ignore */
            const records = await db.table("analyses").toArray()
            setAnalysisHistory(records.map((record) => JSON.parse(record.analysis)))
        })()
    }, [])

    return (
        <AppContext.Provider value={{
            harmonizationFields, addHarmonizationField, removeHarmonizationField,

            analysisHistory, analysis, setActiveAnalysisKey,
            
            graphData, networkRef,

            loading,
            
            loadAnalysisFile, clearAnalysis, downloadAnalysis, deleteAnalysis,
            activeCommunityAlgorithm, setActiveCommunityAlgorithm,

            zoomIntoCluster
        }}>
            { children }
        </AppContext.Provider>
    )
}
export const useApp = () => useContext(AppContext)