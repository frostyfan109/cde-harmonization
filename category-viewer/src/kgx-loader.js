import { Space, Tag } from 'antd'
import { PastelPalette } from './palette'

export const cdeToNetwork = (cde) => {
    const net = { nodes: [], edges: [] }
    const palette = new PastelPalette({ mode: 'hex', seed: { minSaturation: 0.5 } })
    const tagPalette = new PastelPalette({ mode: 'hex', seed: { minSaturation: 0.5 } })
    const tagColors = {}
    cde.forEach((row) => {
        if (!row.variable_name || !row.categories) return
        const id = `${row.variable_name}:${row.survey_name || 0}`
        const categories = row.categories.split(',')

        const rowNodeExists = net.nodes.find((node) => node.id === id)
        
        const tooltip = document.createElement('div')
        tooltip.className = 'node-field-tooltip'
        tooltip.innerText = id
        const tags = document.createElement('div')
        tags.className = 'category-tag-container'
        categories.forEach((category) => {
            const tag = document.createElement('div')
            tag.className = 'ant-tag ant-tag-has-color'
            if (!tagColors[category]) tagColors[category] = tagPalette.getNextColor()
            tag.style.backgroundColor = tagColors[category]
            tag.innerText = category
            tags.appendChild(tag)
        })
        tooltip.appendChild(tags)
        if (!rowNodeExists) net.nodes.push({
            id,
            name: id,
            title: tooltip,
            type: 'field'
        })
        // else console.warn(`Duplicate row found with id ${id}`)
        categories.forEach((category) => {
        const categoryNodeExists = net.nodes.find((node) => node.id === category)
        if (!categoryNodeExists) net.nodes.push({
            id: category,
            name: category,
            title: category,
            color: palette.getNextColor(),
            size: 75,
            type: 'category'
        })
        net.edges.push({
            from: category,
            to: id
        })
        })
    })
    
    // console.log(sortedCategories.map((category) => `${category.id}: ${net.edges.filter((e) => e.from === category.id).length}`))

    return net
}