document.querySelectorAll("[data-year]").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
});

const grid = document.getElementById("product-grid");

if (grid) {
    const products = Array.from(grid.querySelectorAll(".product-card"));
    const filters = Array.from(document.querySelectorAll("[data-filter]"));
    const search = document.getElementById("product-search");
    const sort = document.getElementById("product-sort");
    const resultCount = document.getElementById("result-count");
    const emptyState = document.getElementById("empty-state");
    const pagination = document.getElementById("product-pagination");
    const previousPage = document.getElementById("previous-page");
    const nextPage = document.getElementById("next-page");
    const pageStatus = document.getElementById("page-status");
    const pageSize = 16;
    let currentPage = 1;
    let category = "all";

    const searchableProducts = products.map((element) => ({
        element,
        name: element.querySelector("h3").textContent.trim(),
        text: element.querySelector(".product-content").textContent.toLowerCase(),
        category: element.dataset.category
    }));

    function updateProducts(resetPage = true) {
        if (resetPage) currentPage = 1;
        const query = search.value.trim().toLowerCase();
        const words = query.split(/\s+/).filter(Boolean);
        const ordered = [...searchableProducts];

        if (sort.value !== "featured") {
            ordered.sort((a, b) => {
                const comparison = a.name.localeCompare(b.name, "en", { sensitivity: "base" });
                return sort.value === "az" ? comparison : -comparison;
            });
        }

        const matching = ordered.filter((product) => {
            const matchesCategory = category === "all" || product.category === category;
            const matchesSearch = words.every((word) => product.text.includes(word));
            return matchesCategory && matchesSearch;
        });
        const pageCount = Math.max(1, Math.ceil(matching.length / pageSize));
        currentPage = Math.min(currentPage, pageCount);
        const start = (currentPage - 1) * pageSize;
        const end = Math.min(start + pageSize, matching.length);
        const visible = new Set(matching.slice(start, end));

        ordered.forEach((product) => {
            product.element.hidden = !visible.has(product);
            grid.append(product.element);
        });

        resultCount.textContent = matching.length === 0
            ? `Showing 0 of ${products.length} finds`
            : `Showing ${start + 1}-${end} of ${matching.length} finds${category !== "all" || query ? ` (${products.length} total)` : ""}`;
        emptyState.hidden = matching.length !== 0;
        grid.hidden = matching.length === 0;
        pagination.hidden = pageCount <= 1;
        previousPage.disabled = currentPage === 1;
        nextPage.disabled = currentPage === pageCount;
        pageStatus.textContent = `Page ${currentPage} of ${pageCount}`;
        filters.forEach((button) => {
            const active = button.dataset.filter === category;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });
    }

    filters.forEach((button) => {
        button.addEventListener("click", () => {
            category = button.dataset.filter;
            updateProducts();
        });
    });

    document.querySelectorAll("[data-category-link]").forEach((link) => {
        link.addEventListener("click", () => {
            category = link.dataset.categoryLink;
            search.value = "";
            updateProducts();
        });
    });

    search.addEventListener("input", () => updateProducts());
    sort.addEventListener("change", () => updateProducts());
    function changePage(direction) {
        currentPage += direction;
        updateProducts(false);
        resultCount.focus({ preventScroll: true });
        document.getElementById("results-bar").scrollIntoView({ block: "start" });
    }
    previousPage.addEventListener("click", () => changePage(-1));
    nextPage.addEventListener("click", () => changePage(1));
    document.getElementById("reset-filters").addEventListener("click", () => {
        category = "all";
        search.value = "";
        sort.value = "featured";
        updateProducts();
        search.focus();
    });

    document.getElementById("shop-tools").hidden = false;
    document.getElementById("results-bar").hidden = false;
    updateProducts();
}
