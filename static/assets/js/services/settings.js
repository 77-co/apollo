function animateContentChange(contentCategoryId) {
    // Set category buttons
    $("#settings .categories .category").removeClass("active");
    $(
        `#settings .categories .category[data-category-id="${contentCategoryId}"]`
    ).addClass("active");

    // Step 1: Animate content out of view
    anime.remove("#settings .content");
    anime({
        targets: "#settings .content",
        scale: 0.9,
        opacity: 0,
        easing: "easeInCubic",
        duration: 250,
        complete: function () {
            // Place for content-changing logic
            // This will be called after the content is out of view
            // Example:
            setContentCategory(contentCategoryId);

            // Step 2: Animate content back to original position
            anime({
                targets: "#settings .content",
                scale: [1.1, 1],
                opacity: 1,
                easing: "easeOutCubic",
                duration: 250,
            });
        },
    });
}

function setContentCategory(id) {
    $("#settings .content .category").hide();
    $(`#settings .content .category#${id}`).show();
}

// Call the function on category click
$("#settings .categories .category").on("click", function (e) {
    animateContentChange($(e.target).data("category-id"));
});

$(window).on("load", function () {
    $("#settings .categories .category:first-child").click();

    $("#settings .setting").each(async function (i, el) {
        if (el.tagName === "INPUT" && $(el).attr("type") === "checkbox") {
            // Is a checkbox
            el.checked = await window.backend.settings.get(
                $(el).data("setting-key")
            );
        } else if (el.tagName === "INPUT") {
            // Is a text input field
            console.log($(el).data("setting-key"));
            el.value = await window.backend.settings.get(
                $(el).data("setting-key")
            );
        } else if (el.tagName === "SELECT") {
            // Is a select menu
            el.value = await window.backend.settings.get(
                $(el).data("setting-key")
            );
        }
    });
});

function setting(el) {
    if (el.tagName === "INPUT" && $(el).attr("type") === "checkbox") {
        // Is a checkbox
        window.backend.settings.set($(el).data("setting-key"), el.checked);
    } else if (el.tagName === "INPUT") {
        // Is a text input field
        window.backend.settings.set($(el).data("setting-key"), el.value);
    } else if (el.tagName === "SELECT") {
        // Is a select menu
        window.backend.settings.set($(el).data("setting-key"), el.value);
    }
}
