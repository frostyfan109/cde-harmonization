import React, { Fragment, useMemo, useState } from 'react'
import { Empty, Layout, Segmented, Space, Typography, Menu, Collapse, Badge, Tag, Button } from 'antd'
import { RightOutlined } from '@ant-design/icons'
import { ProList } from '@ant-design/pro-components'
import { SizeMe } from 'react-sizeme'
import { useApp } from './app-context'
import { DebouncedInput } from './debounced-input'
import { AnalysisNetwork } from './converter'
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
    clusters: AnalysisNetwork[]
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
    const { analysis, activeCommunityAlgorithm, setActiveCommunityAlgorithm, zoomIntoCluster } = useApp()
    const [activeListView, setActiveListView] = useState<React.Key|undefined>("all")
    const [search, setSearch] = useState<string>("")

    const completeClusters = useMemo(() => (
        activeCommunityAlgorithm
            ? activeCommunityAlgorithm.clusters.filter((cluster) => cluster.edges.every((edge) => edge.decision !== null))
            : []
    ), [activeCommunityAlgorithm])
    const incompleteClusters = useMemo(() => (
        activeCommunityAlgorithm
            ? activeCommunityAlgorithm.clusters.filter((cluster) => cluster.edges.some((edge) => edge.decision !== null))
            : []
    ), [activeCommunityAlgorithm])
    const todoClusters = useMemo(() => (
        activeCommunityAlgorithm
            ? activeCommunityAlgorithm.clusters.filter((cluster) => !cluster.edges.every((edge) => edge.decision !== null))
            : []
    ), [activeCommunityAlgorithm])
    const dataSource = useMemo(() => (
        (
            activeListView === "all"
                ? activeCommunityAlgorithm?.clusters || []
            : activeListView === "done"
                ? completeClusters
            : activeListView === "incomplete"
                ? incompleteClusters
            : todoClusters
        ).map((cluster, i) => ({
            name: `Cluster ${ i + 1 }`,
            desc: cluster.nodes.reduce<string[]>((acc, n) => ([ ...acc, ...n.categories.filter((category) => category && !acc.includes(category)) ]), []),
            index: i,
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
    ), [completeClusters, incompleteClusters, todoClusters, activeCommunityAlgorithm, activeListView])

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
                    label: <span>Incomplete <ListHeaderBadge count={ incompleteClusters!.length } active={ activeListView === "incomplete" } /></span>
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
                            <Tag style={{ marginRight: 4, marginBottom: 4 }} key={ category }>{ category }</Tag>
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
                <SizeMe monitorHeight>
                    { ({ size }) => (
                        <div style={{ height: size.height !== null ? size.height : "auto", overflow: "auto" }}>
                            <ProList
                                rowKey="name"
                                dataSource={ dataSource }
                                metas={ metaOptions }
                                toolbar={ toolbarOptions }
                                onItem={ ({ index }) => ({
                                    onMouseEnter: () => {

                                    },
                                    onMouseLeave: () => {

                                    },
                                    onClick: () => {
                                        zoomIntoCluster(index)
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