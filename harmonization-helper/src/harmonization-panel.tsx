import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Empty, Layout, Segmented, Space, Typography, Menu, Collapse, Badge, Tag, Button, PageHeader, Divider, Select } from 'antd'
import { RightOutlined } from '@ant-design/icons'
import { blue, cyan } from '@ant-design/colors'
import { ProList } from '@ant-design/pro-components'
import { SizeMe } from 'react-sizeme'
import { useApp } from './app-context'
/* @ts-ignore */
import chroma from 'chroma-js'
import { DebouncedInput } from './debounced-input'
import { useLunrSearch } from './use-lunr-search'
import { AnalysisNetwork, ClusterAnalysisNetwork, clustersToNetworks, clusterToNetwork, CompleteClusterAnalysisNetwork, HarmonizationDecision, ValidHarmonizationDecisions } from './converter'
import './harmonization-panel.css'

const { Sider } = Layout
const { Panel } = Collapse
const { Text, Title } = Typography

enum ClusterStatus {
    DONE,
    INCOMPLETE,
    TODO
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
const ClusterHarmonization = ({
    cluster: _cluster,
    prevCluster,
    nextCluster,
    onBack
}: {
    cluster: ClusterAnalysisNetwork
    prevCluster: string | undefined
    nextCluster: string | undefined
    onBack: () => void
}) => {
    const { analysis, categoryColors, categoryPalette, setActiveCluster, harmonizationFields, updateHarmonizationDecision } = useApp()

    const cluster = useMemo(() => clusterToNetwork(_cluster, analysis!.network, analysis!.metadata.idField), [_cluster, analysis])

    return (
        <PageHeader
            onBack={ onBack }
            title={ cluster.name }
            subTitle={ cluster.edges.length + " matches" }
            extra={[
                <Button
                    type="default"
                    key="back"
                    disabled={ prevCluster === undefined }
                    onClick={ () => setActiveCluster(prevCluster!) }
                >
                    Prev
                </Button>,
                <Button
                    type="primary"
                    key="next"
                    disabled={ nextCluster === undefined }
                    onClick={ () => setActiveCluster(nextCluster!) }
                >
                    Next
                </Button>
            ]}
            >
                <div style={{ marginBottom: 8 }}>
                    {
                        cluster.nodes
                            .reduce<string[]>((acc, n) => ([ ...acc, ...n.categories.filter((category) => category && !acc.includes(category)) ]), [])
                            .map((category) => (
                                <Tag
                                    color={ categoryColors.current![category] }
                                    style={{
                                        color: chroma.contrast(categoryColors.current![category], "#fff") >= 3 ? "#fff" : "#000",
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
                <ProList
                    rowKey="id"
                    itemLayout="vertical"
                    dataSource={
                        cluster.edges.sort((a, b) => b.score - a.score).map((edge) => {
                            const { nameField, idField } = analysis!.metadata
                            const source = cluster.nodes.find((n) => n[idField] === edge.source)!
                            const target = cluster.nodes.find((n) => n[idField] === edge.target)!

                            // Show the last `idCutoff` characters of a CDE id
                            const idCutoff = 6

                            return {
                                id: `${ edge.source }-${ edge.target }`,
                                name: (
                                    <span style={{ fontSize: 15, fontWeight: 500 }}>
                                        { source[nameField] }
                                        &nbsp;⟷&nbsp;
                                        { target[nameField] }
                                    </span>
                                ),
                                idNames: [ source[idField].slice(-idCutoff), target[idField].slice(-idCutoff) ],
                                source,
                                target,
                                edge
                            }
                        })
                    }
                    metas={{
                        title: {
                          dataIndex: "name"
                        },
                        description: {
                            dataIndex: ["edge", "source", "target", "idNames"],
                            render: (_, { edge, source, target, idNames }) => (
                                <Space direction="vertical" size="small" style={{ width: "100%" }}>
                                    <small style={{ fontSize: 13 }}>
                                        n0:{ idNames[0] }
                                        &nbsp;⟷&nbsp;
                                        n1:{ idNames[1] }
                                    </small>
                                    <Divider style={{ marginTop: 2, marginBottom: 2 }} />
                                    <Space direction="vertical" size="middle" style={{ marginTop: -16, width: "100%" }}>
                                        {
                                            harmonizationFields.length > 0 ? harmonizationFields.map((field: string) => (
                                                <div key={ field } style={{ wordBreak: "break-word" }}>
                                                    <div style={{ color: "rgba(0, 0, 0, 0.85)", fontWeight: 500 }}>{ field }</div>
                                                    <div style={{ marginTop: 8, marginLeft: 2, paddingLeft: 10, borderLeft: "1px solid rgba(0, 0, 0, 0.06)" }}>
                                                        { [source, target].map((node, i) => (
                                                            <div key={ i } style={{ color: "#000000D9" }}>
                                                                <Text type="secondary">n{i}:</Text>
                                                                &nbsp;
                                                                {
                                                                    node[field] !== ""
                                                                        ? node[field]
                                                                        : <Text type="secondary" italic>empty</Text>
                                                                }
                                                            </div>
                                                        )) }
                                                    </div>
                                                </div>
                                            )) : (
                                                <div style={{ paddingTop: 24 }}>
                                                    <Empty description="Select harmonization fields in your settings"/>
                                                </div>
                                            )
                                        }
                                    </Space>
                                    <Select
                                        mode="multiple"
                                        allowClear
                                        placeholder="Classify match"
                                        value={ edge.decision !== null ? edge.decision.map((decision) => decision.id) : [] }
                                        options={ ValidHarmonizationDecisions.map(({ id, name }) => ({
                                            label: name,
                                            value: id
                                        })) }
                                        onChange={ (ids) => updateHarmonizationDecision(
                                            cluster.id,
                                            edge.source,
                                            edge.target,
                                            ids.length !== 0
                                                ? ids.map((_id: string) => ValidHarmonizationDecisions.find(({ id }) => id === _id)!)
                                                : null
                                        ) }
                                        style={{ width: "100%", marginTop: 16 }}
                                    />
                                </Space>
                            )
                        }
                    }}
                    locale={{
                        emptyText: <Empty description="No data" />
                    }}
                    style={{ marginLeft: -4, marginRight: -4 }}
                    className="cluster-harmonization-list"
                />
        </PageHeader>
    )
}

const HarmonizationPanelBody = ({ }) => {
    const {
        analysis, activeCommunityAlgorithm, setActiveCommunityAlgorithm,
        activeCluster, setActiveCluster,
        zoomIntoCluster, harmonizationFields,
        categoryColors, categoryPalette
    } = useApp()
    const [activeListView, setActiveListView] = useState<React.Key|undefined>("all")
    const [search, setSearch] = useState<string>("")

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
                activeCommunityAlgorithm.clusters.filter((cluster) => (
                    !completeClusters.find((c) => c.id === cluster.id) &&
                    cluster.edges.some((edge) => edge.decision !== null))
                ),
                analysis!.network,
                analysis!.metadata.idField
            ) : []
    ), [analysis, completeClusters, activeCommunityAlgorithm])
    const todoClusters = useMemo(() => (
        activeCommunityAlgorithm ?
            clustersToNetworks(
                activeCommunityAlgorithm.clusters.filter((cluster) => (
                    !incompleteClusters.find((c) => c.id === cluster.id) &&
                    !cluster.edges.every((edge) => edge.decision !== null))
                ),
                analysis!.network,
                analysis!.metadata.idField
            ) : []
    ), [analysis, incompleteClusters, activeCommunityAlgorithm])

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
        filteredClusterData
            .map((cluster) => ({
                id: cluster.id,
                name: cluster.name,
                categories: cluster.nodes.reduce<string[]>((acc, n) => ([ ...acc, ...n.categories.filter((category) => category && !acc.includes(category)) ]), []),
                status: (
                    completeClusters.find((c) => c.id === cluster.id)
                        ? ClusterStatus.DONE
                    : incompleteClusters.find((c) => c.id === cluster.id)
                        ? ClusterStatus.INCOMPLETE
                    : ClusterStatus.TODO
                ),
                completion: [
                    cluster.edges.filter((edge) => edge.decision !== null).length,
                    cluster.edges.length
                ],
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
            .sort((a, b) => {
                const evaluate = (x: any) => (
                    x.status === ClusterStatus.DONE
                        ? 3
                    : x.status === ClusterStatus.INCOMPLETE
                        ? 2
                    : 1
                )
                return evaluate(b) - evaluate(a)
            })
    ), [completeClusters, incompleteClusters, filteredClusterData])

    const toolbarOptions = useMemo(() => ({
        menu: {
            activeKey: activeListView,
            items: [
                {
                    key: "all",
                    label: (
                        <span>
                            All&nbsp;
                            <ListHeaderBadge
                                count={ activeCommunityAlgorithm?.clusters.length || 0 }
                                active={ activeListView === "all" }
                            />
                        </span>
                    )
                },
                {
                    key: "done",
                    label: (
                        <span>
                            Done&nbsp;
                            <ListHeaderBadge
                                count={ completeClusters!.length }
                                active={ activeListView === "done" }
                            />
                        </span>
                    )
                },
                {
                    key: "incomplete",
                    label: (
                        <span>
                            Started&nbsp;
                            <ListHeaderBadge
                                count={ incompleteClusters!.length }
                                active={ activeListView === "incomplete" }
                            />
                        </span>
                    )
                },
                {
                    key: "todo",
                    label: (
                        <span>
                            Not started&nbsp;
                            <ListHeaderBadge
                                count={ todoClusters!.length }
                                active={ activeListView === "todo" }
                            />
                        </span>
                    )
                }
            ],
            onChange: (key: React.Key | undefined) => setActiveListView(key)
        },
        search: (
            <DebouncedInput
                debounce={ 300 }
                defaultValue={ search }
                setValue={ setSearch }
                inputProps={{
                    placeholder: "Search",
                    style: { minWidth: 200 }
                }}
            />
        )
    }), [activeListView, activeCommunityAlgorithm, completeClusters, incompleteClusters, todoClusters, search])

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
            dataIndex: ["categories", "status", "completion"],
            // render: (categories) => (categories as string[]).join(", ")
            render: (_: any, { status, categories, completion }: any) => (
                <div>
                    { true && (
                        <div style={{ marginTop: -8 }}>
                            <small>
                                <i>
                                    { completion[0] }/{ completion[1] } done
                                </i>
                            </small>
                        </div>
                    ) }
                    <div style={{ marginTop: 8 }}>
                        {
                            (categories as string[]).map((category) => (
                                <Tag
                                    color={ categoryColors.current![category] }
                                    style={{
                                        color: chroma.contrast(categoryColors.current![category], "#fff") >= 3 ? "#fff" : "#000",
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
            render: (_: any, data: any) => (
                <Fragment>
                    <Button
                        type="text"
                        icon={ <RightOutlined /> }
                        onClick={ () => setActiveCluster(data.id) }
                    />
                </Fragment>
            )
        },
        
    }), [])

    useEffect(() => {
        if (analysis) {
            analysis.network.nodes.flatMap((n) => n.categories).forEach((category) => {
                if (!categoryColors.current![category]) categoryColors.current![category] = categoryPalette.current!.getNextColor()
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
                            {
                                activeCluster ? (
                                    <ClusterHarmonization
                                        cluster={ activeCluster }
                                        prevCluster={
                                            filteredClusterData[filteredClusterData.findIndex((c) => c.id === activeCluster.id) - 1]?.id
                                        }
                                        nextCluster= {
                                            filteredClusterData[filteredClusterData.findIndex((c) => c.id === activeCluster.id) + 1]?.id
                                        }
                                        onBack={ () => setActiveCluster(null) }
                                    />
                                ) : (
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
                                )
                            }
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