let openAnimationRunning = false;
function openApp(appId, widget) {
    if (openAnimationRunning) return;

    openAnimationRunning = true;
    const widgetRect = widget.getBoundingClientRect();
    const widgetStyle = getComputedStyle(widget);
    const expandDiv = document.createElement('div');
    expandDiv.classList.add('expand');

    // Apply initial size and position
    expandDiv.style.width = `${widgetRect.width}px`;
    expandDiv.style.height = `${widgetRect.height}px`;
    expandDiv.style.top = `${widgetRect.top}px`;
    expandDiv.style.left = `${widgetRect.left}px`;

    // Port the backgroundImage (usually gradient)
    expandDiv.style.backgroundImage = widgetStyle.backgroundImage;

    document.body.appendChild(expandDiv);

    $('#uiContainer').addClass('shaded');

    // Fade in and expand to full screen after a slight delay
    setTimeout(() => {
        expandDiv.classList.add('show');
        expandDiv.classList.add('fullscreen');
        expandDiv.style.width = null;
        expandDiv.style.height = null;
        expandDiv.style.top = null;
        expandDiv.style.left = null;
        setTimeout(() => {
            // Swap the temporary expanding div for the actual apps div.
            $('.apps').show();
            expandDiv.classList.remove('show');

            // Set active app
            setActiveApp(appId);

            setTimeout(() => {
                expandDiv.remove();
                openAnimationRunning = false;
            }, 300);
        }, 300);
    }, 20);
}

// This opens an app through an id
function setActiveApp(appId) {
    $('.apps .app').removeClass('active');
    $(`.apps .app#${appId}`).addClass('active');

    const event = document.createEvent('Event');

    event.initEvent('appopen');
    document.getElementById(appId).dispatchEvent(event);
}

// This closes the current app
function closeApp() {
    if (openAnimationRunning) return;

    openAnimationRunning = true;

    $('#uiContainer').removeClass('shaded');
    anime({
        targets: '.apps',
        scale: [1, 0.6],
        opacity: [1, 0],
        easing: 'easeOutQuad',
        duration: 350,
        complete: () => {
            $('.apps .app').removeClass('active');
            $('.apps').attr('style', '');
            openAnimationRunning = false;
        }
    });
}

$('#closeAppButton').on('click', closeApp);