const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const products = JSON.parse(fs.readFileSync(path.join(root, "products.json"), "utf8"));
const categories = {
    bedding: "BEDDING & COMFORT",
    drinkware: "DRINKWARE",
    home: "HOME ESSENTIALS",
    clothing: "EASY, EVERYDAY STYLE",
    beauty: "BEAUTY & SKINCARE"
};
const filterLabels = {
    bedding: "Bedding",
    drinkware: "Drinkware",
    home: "Home essentials",
    clothing: "Clothing",
    beauty: "Beauty"
};

if (!Array.isArray(products)) {
    throw new Error("products.json must contain an array of product objects.");
}

products.forEach((product, index) => {
    const label = `Product ${index + 1}`;
    if (!product || typeof product !== "object" || Array.isArray(product)) {
        throw new Error(`${label} must be an object.`);
    }
    for (const field of ["name", "category", "url", "image", "alt", "description"]) {
        if (typeof product[field] !== "string" || !product[field].trim()) {
            throw new Error(`${label}: "${field}" must be a non-empty string.`);
        }
    }
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(product.category) || product.category === "all") {
        throw new Error(`${label}: category "${product.category}" must use lowercase letters, numbers, and single hyphens (for example "automotive" or "pet-supplies"). "all" is reserved.`);
    }
    const url = new URL(product.url);
    if (url.protocol !== "https:" || url.username || url.password ||
        !(url.hostname === "amzn.to" || url.hostname === "amazon.com" || url.hostname.endsWith(".amazon.com") || url.hostname === "link.amazon")) {
        throw new Error(`${label}: use an HTTPS amzn.to, amazon.com, or link.amazon affiliate URL.`);
    }
    if (!/^images\/[^\\?#]+$/i.test(product.image) || product.image.split("/").some((part) => part === ".." || part === ".")) {
        throw new Error(`${label}: image must be a relative path inside images/.`);
    }
    if (!fs.statSync(path.join(root, product.image)).isFile()) {
        throw new Error(`${label}: image is not a file: ${product.image}`);
    }
    if (product.badge !== undefined && typeof product.badge !== "string") {
        throw new Error(`${label}: optional "badge" must be a string.`);
    }
    if (product.lifestyleImage !== undefined && typeof product.lifestyleImage !== "boolean") {
        throw new Error(`${label}: optional "lifestyleImage" must be true or false.`);
    }
});

const categoryIds = [...new Set([...Object.keys(categories), ...products.map((product) => product.category)])];
function categoryLabel(category) {
    return category.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

const cards = products.map((product) => {
    const badge = product.badge
        ? `<span class="product-badge">${escapeHtml(product.badge)}</span>`
        : "";
    return `          <article class="product-card${product.lifestyleImage ? " product-card-lifestyle" : ""}" data-category="${product.category}">
            <div class="product-image">${badge}<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt)}" width="360" height="360" loading="lazy"></div>
            <div class="product-content"><p class="product-category">${escapeHtml(Object.hasOwn(categories, product.category) ? categories[product.category] : categoryLabel(product.category).toUpperCase())}</p><h3>${escapeHtml(product.name)}</h3><p class="product-description">${escapeHtml(product.description)}</p><a class="amazon-link" href="${escapeHtml(product.url)}" target="_blank" rel="sponsored nofollow noopener noreferrer">View on Amazon <span aria-hidden="true">&nearr;</span><span class="sr-only">: ${escapeHtml(product.name)} (opens in a new tab)</span></a></div>
          </article>`;
}).join("\n");

const filename = path.join(root, "index.html");
let html = fs.readFileSync(filename, "utf8");

function replaceOnce(pattern, replacement) {
    let matches = 0;
    html = html.replace(pattern, (...args) => {
        matches += 1;
        return replacement(...args);
    });
    if (matches !== 1) {
        throw new Error(`Expected one storefront section matching ${pattern}; found ${matches}. No file was saved.`);
    }
}

replaceOnce(/(<!-- PRODUCTS:START -->)[\s\S]*?(<!-- PRODUCTS:END -->)/g,
    (_, start, end) => `${start}\n${cards}\n          ${end}`);
replaceOnce(/(<script id="collection-schema" type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g,
    (_, start, content, end) => {
        const schema = JSON.parse(content);
        schema.about = [...new Set(products.map((product) => product.category))].map((category) => ({
            "@type": "Thing",
            name: Object.hasOwn(categories, category) ? categories[category] : categoryLabel(category)
        }));
        schema.mainEntity = {
            "@type": "ItemList",
            numberOfItems: products.length,
            itemListElement: products.map((product, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: product.name,
                url: product.url
            }))
        };
        const json = JSON.stringify(schema, null, 2).replace(/</g, "\\u003c");
        return `${start}\n${json}\n  ${end}`;
    });
replaceOnce(/(<span class="collection-count">)[\s\S]*?(<\/span>)/g,
    (_, start, end) => `${start}THE EVERYDAY COLLECTION / ${products.length} FINDS${end}`);
replaceOnce(/(<div class="filter-list"[^>]*>)[\s\S]*?(<\/div>)/g,
    (_, start, end) => `${start}
            <button type="button" class="filter active" data-filter="all" aria-pressed="true">All finds <span>${products.length}</span></button>
${categoryIds.map((category) => `            <button type="button" class="filter" data-filter="${category}" aria-pressed="false">${escapeHtml(Object.hasOwn(filterLabels, category) ? filterLabels[category] : categoryLabel(category))}</button>`).join("\n")}
          ${end}`);
replaceOnce(/(<p id="result-count"[^>]*>)[\s\S]*?(<\/p>)/g,
    (_, start, end) => `${start}Showing all ${products.length} finds${end}`);

fs.writeFileSync(filename, html);
console.log(`Built ${products.length} products in index.html, including product counts and SEO structured data.`);
