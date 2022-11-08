import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Empty, Layout, Segmented, Space, Typography, Menu, Collapse, Badge, Tag, Button } from 'antd'
import { RightOutlined } from '@ant-design/icons'
import { blue, cyan } from '@ant-design/colors'
import { ProList } from '@ant-design/pro-components'
import { SizeMe } from 'react-sizeme'
import { useApp } from './app-context'
/* @ts-ignore */
import chroma from 'chroma-js'
import { DebouncedInput } from './debounced-input'
import { useLunrSearch } from './use-lunr-search'
import { AnalysisNetwork, ClusterAnalysisNetwork, clustersToNetworks, CompleteClusterAnalysisNetwork } from './converter'
import { Palette, PastelPalette } from './palette'
import './harmonization-panel.css'

const { Sider } = Layout
const { Panel } = Collapse
const { Title } = Typography

enum ClusterStatus {
    DONE,
    INCOMPLETE,
    TODO
}

interface HarmonizationClusterProps {
    clusters: ClusterAnalysisNetwork[]
}

const ListHeaderBadge = ({ count, active }: { count: number, active: boolean }) => {
    return (
        <Badge
            count={ count }
            showZero={ true }
            overflowCount={ 999 }
            style={{
                marginBlockStart: -2,
                marginInlineStart: 4,
                color: active ? "#1890ff" : "#999",
                backgroundColor: active ? "#e6f7ff" : "#eee"
            }}
        />
    )
}

const HarmonizationPanelBody = ({ }) => {
    const { analysis, activeCommunityAlgorithm, setActiveCommunityAlgorithm, zoomIntoCluster, harmonizationFields } = useApp()
    const [activeListView, setActiveListView] = useState<React.Key|undefined>("all")
    const [search, setSearch] = useState<string>("")
    
    const categoryColors = useRef<{ [category: string]: string }>({})
    const palette = useRef(new Palette(chroma(cyan[3]), { mode: 'hex' }))

    const completeClusters = useMemo(() => (
        activeCommunityAlgorithm ?
            clustersToNetworks(
                activeCommunityAlgorithm.clusters.filter((cluster) => cluster.edges.every((edge) => edge.decision !== null)),
                analysis!.network,
                analysis!.metadata.idField
            ) : []
    ), [analysis, activeCommunityAlgorithm])
    const incompleteClusters = useMemo(() => (
        activeCommunityAlgorithm ?
            clustersToNetworks(
                activeCommunityAlgorithm.clusters.filter((cluster) => cluster.edges.some((edge) => edge.decision !== null)),
                analysis!.network,
                analysis!.metadata.idField
            ) : []
    ), [analysis, activeCommunityAlgorithm])
    const todoClusters = useMemo(() => (
        activeCommunityAlgorithm ?
            clustersToNetworks(
                activeCommunityAlgorithm.clusters.filter((cluster) => !cluster.edges.every((edge) => edge.decision !== null)),
                analysis!.network,
                analysis!.metadata.idField
            ) : []
    ), [analysis, activeCommunityAlgorithm])

    const clusterData = useMemo(() => (
        activeListView === "all"
            ? activeCommunityAlgorithm
                ? clustersToNetworks(activeCommunityAlgorithm!.clusters, analysis!.network, analysis!.metadata.idField)
                : []
        : activeListView === "done"
            ? completeClusters
        : activeListView === "incomplete"
            ? incompleteClusters
        : todoClusters
    ), [activeListView, completeClusters, incompleteClusters, todoClusters, activeCommunityAlgorithm, analysis])

    const docs = useMemo(() => (
        clusterData.map((cluster) => ({
            id: cluster.id,
            name: cluster.name,
            categories: cluster.nodes.reduce<string[]>((acc, n) => ([ ...acc, ...n.categories.filter((category) => category && !acc.includes(category)) ]), []).join(" "),
            ...Object.fromEntries(harmonizationFields.map((field: string) => ([
                field,
                cluster.nodes.reduce<any[]>((acc, n) => ([
                    ...acc,
                    n[field]
                ]), []).join(" ")
            ])))
        }))
    ), [clusterData, harmonizationFields])

    const lunrConfig = useMemo(() => ({
        docs,
        index: {
            ref: "id",
            fields: [
                "name",
                "categories",
                ...harmonizationFields
            ]
        }
    }), [docs, harmonizationFields])
    const { index, lexicalSearch } = useLunrSearch(lunrConfig)

    const filteredClusterData = useMemo<CompleteClusterAnalysisNetwork[]>(() => {
        if (search.length < 3) return clusterData

        const { hits, tokens } = lexicalSearch(search)
        // Arbitrary threshold score
        const minScore = 0.5
        return hits.filter((hit: any) => hit.score >= minScore).map((hit: any) => clusterData.find((cluster) => cluster.id === hit.ref)!)
    }, [clusterData, search, lexicalSearch])

    const dataSource = useMemo(() => (
        filteredClusterData.map((cluster) => ({
            id: cluster.id,
            name: cluster.name,
            desc: cluster.nodes.reduce<string[]>((acc, n) => ([ ...acc, ...n.categories.filter((category) => category && !acc.includes(category)) ]), []),
            status: (
                completeClusters.find((c) => c === cluster)
                    ? ClusterStatus.DONE
                : incompleteClusters.find((c) => c === cluster)
                    ? ClusterStatus.INCOMPLETE
                : ClusterStatus.TODO
            ),
            content: [
                {
                    label: "CDEs",
                    value: cluster.nodes.length
                },
                {
                    label: "Matches",
                    value: cluster.edges.length
                }
            ]
        }))
    ), [completeClusters, incompleteClusters, filteredClusterData])

    const toolbarOptions = useMemo(() => ({
        menu: {
            activeKey: activeListView,
            items: [
                {
                    key: "all",
                    label: <span>All <ListHeaderBadge count={ activeCommunityAlgorithm?.clusters.length || 0 } active={ activeListView === "all" } /></span>
                },
                {
                    key: "done",
                    label: <span>Done <ListHeaderBadge count={ completeClusters!.length } active={ activeListView === "done" } /></span>
                },
                {
                    key: "incomplete",
                    label: <span>Started <ListHeaderBadge count={ incompleteClusters!.length } active={ activeListView === "incomplete" } /></span>
                },
                {
                    key: "todo",
                    label: <span>Not started <ListHeaderBadge count={ todoClusters!.length } active={ activeListView === "todo" } /></span>
                }
            ],
            onChange: (key: React.Key | undefined) => setActiveListView(key)
        },
        search: (
            <DebouncedInput
                debounce={ 200 }
                setValue={ setSearch }
                inputProps={{
                    placeholder: "Search",
                    style: { minWidth: 200 }
                }}
            />
        )
    }), [activeListView, activeCommunityAlgorithm, completeClusters, incompleteClusters, todoClusters])

    const metaOptions = useMemo(() => ({
        title: {
            dataIndex: "name"
        },
        subTitle: {
            dataIndex: "status",
            render: (status: React.ReactNode) => (
                <span
                    style = {{
                        display: "inline-block", 
                        width: 8, 
                        height: 8,
                        marginLeft: -8,
                        borderRadius: "50%",
                        backgroundColor: (
                            status === ClusterStatus.DONE
                                ? "#52c41a"
                            : status === ClusterStatus.INCOMPLETE
                                ? "#fa8c16"
                            : "#bfbfbf"
                        ),
                        marginInlineEnd: 8,
                    }}
                />
            )
        },
        description: {
            dataIndex: "desc",
            // render: (categories) => (categories as string[]).join(", ")
            render: (categories: React.ReactNode) => (
                <div style={{ marginTop: 8 }}>
                    {
                        (categories as string[]).map((category) => (
                            <Tag
                                color={ categoryColors.current[category] }
                                style={{
                                    color: chroma.contrast(categoryColors.current[category], "#fff") >= 3 ? "#fff" : "#000",
                                    marginRight: 4,
                                    marginBottom: 4
                                }}
                                key={ category }
                            >
                                { category }
                            </Tag>
                        ))
                    }
                </div>
            )
        },
        content: {
            dataIndex: "content",
            render: (text: React.ReactNode) => (
                <div style={{ display: "flex", justifyContent: "space-around" }}>
                    {
                        (text as any[]).map((t) => (
                            <div key={ t.label }>
                                <div style={{ color: "#00000073" }}>{ t.label }</div>
                                <div style={{ color: "#000000D9" }}>
                                    { t.value }
                                </div>
                            </div>
                        ))
                    }
                </div>
            )
        },
        extra: {
            render: () => (
                <Fragment>
                    <Button type="text" icon={ <RightOutlined /> } />
                </Fragment>
            )
        },
        
    }), [])

    useEffect(() => {
        if (analysis) {
            analysis.network.nodes.flatMap((n) => n.categories).forEach((category) => {
                if (!categoryColors.current[category]) categoryColors.current[category] = palette.current.getNextColor()
            })
        }
    }, [analysis?.network])

    if (!analysis) return <Empty style={{ marginTop: 12 }} />
    return (
        <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
            <Menu
                selectedKeys={[ analysis.activeCommunityAlgorithm ]}
                onClick={ (e) => setActiveCommunityAlgorithm(e.key) }
                mode="horizontal"
                items={ Object.entries(analysis.communities).map(([id, c]) => ({
                    label: c.name,
                    key: id
                })) }
                style={{ marginBottom: 4 }}
            />
            <div style={{ flexGrow: 1 }}>
                <SizeMe monitorHeight refreshMode="debounce">
                    { ({ size }) => (
                        <div style={{ height: size.height !== null ? size.height : "auto", overflow: "auto" }}>
                            <ProList
                                rowKey="name"
                                dataSource={ dataSource }
                                metas={ metaOptions }
                                toolbar={ toolbarOptions }
                                onItem={ ({ id }) => ({
                                    onMouseEnter: () => {

                                    },
                                    onMouseLeave: () => {

                                    },
                                    onClick: () => {
                                        zoomIntoCluster(id)
                                    }
                                }) }
                                locale={{
                                    emptyText: <Empty description="No data" />
                                }}
                                style={{ marginLeft: -4, marginRight: -4 }}
                                className="cluster-list"
                            />
                        </div>
                    ) }
                </SizeMe>
            </div>
        </div>
    )
}

export const HarmonizationPanel = ({ }) => {
    return (
        <Sider
            className="harmonization-panel"
            style={{
                height: '100%',
                background: '#fff',
                padding: '4px 12px 12px 12px'
            }}
        >
            {/* <Title level={ 5 } style={{ marginBottom: 24 }}>Clustering</Title> */}
            <HarmonizationPanelBody />
        </Sider>
    )
}