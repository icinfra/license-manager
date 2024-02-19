// renderer.js

const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const os = require('os');
const path = require('path');
let dbPath = path.join(os.homedir(), '.license-manager', 'license.db');

const sqlite3 = require('sqlite3').verbose();
let db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Connected to the license database.');
});


function openTab(evt, tabName) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}

// Get the element with id="defaultOpen" and click on it
// document.getElementById("defaultOpen").click();

window.onload = function () {
    let select = document.getElementById('featureName');

    // Add "All Features to Products" option
    let allOption = document.createElement('option');
    allOption.value = 'AllFeatures2Products';
    allOption.text = 'All Features to Products';
    select.appendChild(allOption);

    let sql = 'SELECT DISTINCT FeatureName FROM Features';
    db.all(sql, [], (err, rows) => {
        if (err) {
            return console.error(err.message);
        }
        for (let row of rows) {
            let option = document.createElement('option');
            option.value = row.FeatureName;
            option.text = row.FeatureName;
            select.appendChild(option);
        }
    });

    // 获取Products按钮
    let productsButton = document.querySelector('.tablinks[onclick*="Tab2"]');

    // 监听Products按钮的点击事件
    productsButton.addEventListener('click', function () {
        // ... existing code to draw table ...
        let sql = `select pd.ProductId,pd.Quantity,pd.StartDate,pd.EndDate,lf.hostid 
    from ProductDates pd join LicenseFiles lf on pd.LicenseFileId = lf.LicenseFileId 
    order by pd.ProductId;`;
        db.all(sql, (err, rows) => {
            if (err) {
                return console.error(err.message);
            }
            // Use the row data
            console.log(rows);
            let productResultsDiv = document.getElementById('product-results');
            if (rows.length > 0) {
                let tableHtml = `
            <table>
              <tr>
                <th>Product Id</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Quantity</th>
                <th>Host Id</th>
              </tr>
        `;
                for (let row of rows) {
                    tableHtml += `
              <tr>
                <td>${row.ProductId}</td>
                <td>${row.StartDate}</td>
                <td>${row.EndDate}</td>
                <td>${row.Quantity}</td>
                <td>${row.hostid}</td>
              </tr>
            `;
                }
                tableHtml += `</table>`;
                productResultsDiv.innerHTML = tableHtml;
            } else {
                productResultsDiv.innerHTML = `<p>No feature found with name: ${featureName}</p>`;
            }
        });
    });
};

function drawForceDirectedGraph(data) {
    // 假设你已经从后端获取了数据，并将其保存在变量`data`中
    // 创建一个映射，将节点ID映射到节点对象
    // let nodeMap = new Map(data.nodes.map(node => [node.id, node]));

    // // 更新links数组，将source和target从节点ID转换为节点对象
    // data.links.forEach(link => {
    //     link.source = nodeMap.get(link.source);
    //     link.target = nodeMap.get(link.target);
    // });

    // console.log(data);

    const svg = d3.select("#mySvg"),
        width = +svg.attr("width"),
        height = +svg.attr("height");

    // 创建力导向图布局
    const simulation = d3.forceSimulation(data.nodes) // 设置节点数据
        .force("link", d3.forceLink(data.links).id(d => d.id).distance(50)) // 减小链接力的强度
        .force("charge", d3.forceManyBody().strength(-50))
        .force("center", d3.forceCenter(width / 2, height * 2 / 5))
        .force("x", d3.forceX(d => d.group === 1 ? width / 4 : width * 3 / 4).strength(1))
        .force("collide", d3.forceCollide(d => d.r + d.linkCount * 10)) // 增加碰撞力的半径
        .on("end", function() { // 添加这个事件处理函数
            // 获取SVG元素
            var svg = document.getElementById('mySvg');
        
            // 获取SVG元素的内容的实际高度
            var rect = svg.getBoundingClientRect();
        
            // 设置SVG元素的高度为内容的实际高度
            svg.setAttribute('height', rect.height);
        });

    // 定义一个颜色比例尺
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // 绘制关系图
    const link = svg.append("g")
        .attr("stroke", "#999")
        .selectAll("line")
        .data(data.links)
        .enter().append("line")
        .attr("stroke-width", d => Math.sqrt(d.value));

    // 创建节点
    const node = svg.append("g")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .selectAll("circle")
        .data(data.nodes)
        .enter().append("circle")
        .attr("r", 5)
        .attr("fill", d => colorScale(d.group))
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    // 创建文本
    const text = svg.append("g")
        .selectAll("text")
        .data(data.nodes)
        .enter().append("text")
        .text(d => `${d.id}: ${d.value}`)
        .attr("dy", 5)
        .attr("font-size", "10px") // 设置字体大小
        .each(function (d) {
            const bbox = this.getBBox();
            const textWidth = bbox.width;
            d3.select(this).attr("dx", d.group === 1 ? -textWidth - 10 : 10);
        });

    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);

        text // 更新文本的位置
            .attr("x", d => d.x)
            .attr("y", d => d.y);
    });

    function dragstarted(d) {
        if (!d3.event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(d) {
        d.fx = d3.event.x;
        d.fy = d3.event.y;
    }

    function dragended(d) {
        if (!d3.event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    simulation.force("link")
        .links(data.links);

}

function drawGraph() {
    let sql = `SELECT 
    f.FeatureName,
    p.ProductId || '@' || lf.hostid as ProductId,
    pd.Quantity as Quantity
FROM 
    Features f
JOIN 
    ProductFeatureRelation pfr ON f.FeatureId = pfr.FeatureId
JOIN 
    Products p ON pfr.ProductId = p.ProductId
JOIN 
    ProductDates pd ON p.ProductId = pd.ProductId
JOIN
    LicenseFiles lf ON pd.LicenseFileId = lf.LicenseFileId;`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            return console.error(err.message);
        }
        // Create nodes and links for the graph
        let nodes = [];
        let links = [];
        let productIds = new Set();
        let featureNames = new Set();
        let featureCounts = {};
        // console.log(rows);
        for (let row of rows) {
            productIds.add(row.ProductId);
            featureNames.add(row.FeatureName);
            links.push({ source: row.FeatureName, target: row.ProductId });

            // 新增：更新feature的数量
            if (featureCounts[row.FeatureName]) {
                featureCounts[row.FeatureName] += row.Quantity;
            } else {
                featureCounts[row.FeatureName] = row.Quantity;
            }
        }
        for (let featureName of featureNames) {
            nodes.push({ id: featureName, value: featureCounts[featureName], group: 1 });
        }
        for (let productId of productIds) {
            let quantity = rows.filter(row => row.ProductId === productId)[0].Quantity;
            nodes.push({ id: productId, value: quantity, group: 2 });
        }

        // Draw the graph
        console.log({ nodes: nodes, links: links });
        drawForceDirectedGraph({ nodes: nodes, links: links });
    });
}

function queryFeature() {

    let featureName = document.getElementById('featureName').value;
    let resultsDiv = document.getElementById('results');
    if (featureName === 'AllFeatures2Products') {
        // 清空mySvg元素的内容
        document.getElementById('mySvg').innerHTML = '';
        resultsDiv.innerHTML = '';
        drawGraph();
    } else {
        // ... existing code to draw table ...
        let sql = `SELECT pd.StartDate, pd.EndDate, pd.Quantity, lf.FileName, lf.hostid, p.ProductId
    FROM ProductDates pd
    JOIN Products p ON pd.ProductId = p.ProductId
    JOIN ProductFeatureRelation pfr ON p.ProductId = pfr.ProductId
    JOIN Features f ON pfr.FeatureId = f.FeatureId
    JOIN LicenseFiles lf ON pd.LicenseFileId = lf.LicenseFileId
    WHERE f.FeatureName = ?`;
        db.all(sql, featureName, (err, rows) => {
            if (err) {
                return console.error(err.message);
            }

            if (rows.length > 0) {
                let tableHtml = `
                <table>
                  <tr>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Quantity</th>
                    <th>Product Id</th>
                    <th>File Name</th>
                    <th>Host Id</th>
                  </tr>
            `;
                for (let row of rows) {
                    tableHtml += `
                  <tr>
                    <td>${row.StartDate}</td>
                    <td>${row.EndDate}</td>
                    <td>${row.Quantity}</td>
                    <td>${row.ProductId}</td>
                    <td>${row.FileName}</td>
                    <td>${row.hostid}</td>
                  </tr>
                `;
                }
                tableHtml += `</table>`;
                resultsDiv.innerHTML = tableHtml;
            } else {
                resultsDiv.innerHTML = `<p>No feature found with name: ${featureName}</p>`;
            }
        });
    }
}

window.onunload = function () {
    db.close((err) => {
        if (err) {
            return console.error(err.message);
        }
        console.log('Close the database connection.');
    });
};