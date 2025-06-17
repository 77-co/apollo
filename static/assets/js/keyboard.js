let currentLayout = 'letters';
let isShiftPressed = false;
let isCapsLock = false;

const layouts = {
    letters: [
        ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
        ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
        ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'backspace'],
        ['123', 'space', 'enter']
    ],
    numbers: [
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
        ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
        ['#+=', '.', ',', '?', '!', "'", 'backspace'],
        ['ABC', 'space', 'enter']
    ],
    symbols: [
        ['[', ']', '{', '}', '#', '%', '^', '*', '+', '='],
        ['_', '\\', '|', '~', '<', '>', '€', '£', '¥', '•'],
        ['123', '.', ',', '?', '!', "'", 'backspace'],
        ['ABC', 'space', 'enter']
    ]
};

const shiftMap = {
    'q': 'Q', 'w': 'W', 'e': 'E', 'r': 'R', 't': 'T', 'y': 'Y', 'u': 'U', 'i': 'I', 'o': 'O', 'p': 'P',
    'a': 'A', 's': 'S', 'd': 'D', 'f': 'F', 'g': 'G', 'h': 'H', 'j': 'J', 'k': 'K', 'l': 'L',
    'z': 'Z', 'x': 'X', 'c': 'C', 'v': 'V', 'b': 'B', 'n': 'N', 'm': 'M',
    '1': '!', '2': '@', '3': '#', '4': '$', '5': '%', '6': '^', '7': '&', '8': '*', '9': '(', '0': ')',
    '-': '_', '=': '+', '[': '{', ']': '}', '\\': '|', ';': ':', "'": '"', ',': '<', '.': '>', '/': '?'
};

function updateKeyboardTargets() {
    $('input, textarea').off('focus blur');

    $('input, textarea').on('focus', e => {
        if (isTextBox(e.target)) $('.bodyWrapper').addClass('keyboardActive');
    });

    $('input, textarea').on('blur', e => {
        if (isTextBox(e.target)) $('.bodyWrapper').removeClass('keyboardActive');
    });
}

function generateKeyboard() {
    const keyboard = $('.keyboard');
    keyboard.empty();
    
    const currentLayoutKeys = layouts[currentLayout];
    
    currentLayoutKeys.forEach(row => {
        const rowDiv = $('<div class="row"></div>');
        
        row.forEach(key => {
            const keyElement = $('<span class="key"></span>');
            
            // Set key properties based on type
            switch(key) {
                case 'shift':
                    keyElement.addClass('l').attr('id', 'shiftKey');
                    keyElement.html('<span class="material-symbols-outlined">shift</span>');
                    if (isShiftPressed || isCapsLock) keyElement.addClass('active');
                    break;
                case 'backspace':
                    keyElement.addClass('l').attr('id', 'backspaceKey');
                    keyElement.html('<span class="material-symbols-outlined">backspace</span>');
                    break;
                case 'enter':
                    keyElement.addClass('l').attr('id', 'enterKey');
                    keyElement.html('<span class="material-symbols-outlined">keyboard_return</span>');
                    break;
                case 'space':
                    keyElement.addClass('xxl').attr('id', 'spaceKey');
                    keyElement.text(' ');
                    break;
                case '123':
                    keyElement.addClass('l').attr('id', 'numbersKey');
                    keyElement.text('?123');
                    break;
                case 'ABC':
                    keyElement.addClass('l').attr('id', 'lettersKey');
                    keyElement.text('ABC');
                    break;
                case '#+=':
                    keyElement.addClass('l').attr('id', 'symbolsKey');
                    keyElement.text('#+=');
                    break;
                default:
                    let displayKey = key;
                    if (currentLayout === 'letters' && (isShiftPressed || isCapsLock)) {
                        displayKey = shiftMap[key] || key.toUpperCase();
                    }
                    keyElement.text(displayKey);
                    keyElement.attr('data-key', key);
                    break;
            }
            
            rowDiv.append(keyElement);
        });
        
        keyboard.append(rowDiv);
    });
}

function switchLayout(newLayout) {
    currentLayout = newLayout;
    generateKeyboard();
    bindKeyEvents();
}

function insertText(text) {
    const focusedElement = document.activeElement;
    if (!isTextBox(focusedElement)) return;

    const start = focusedElement.selectionStart;
    const end = focusedElement.selectionEnd;
    const currentValue = focusedElement.value;
    
    const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
    focusedElement.value = newValue;
    
    const newPosition = start + text.length;
    focusedElement.setSelectionRange(newPosition, newPosition);
    focusedElement.scrollLeft = focusedElement.scrollWidth;
    
    // Trigger input event for frameworks that listen to it
    focusedElement.dispatchEvent(new Event('input', { bubbles: true }));
}

function deleteText() {
    const focusedElement = document.activeElement;
    if (!isTextBox(focusedElement)) return;

    const start = focusedElement.selectionStart;
    const end = focusedElement.selectionEnd;
    const currentValue = focusedElement.value;
    
    if (start !== end) {
        // Delete selected text
        const newValue = currentValue.substring(0, start) + currentValue.substring(end);
        focusedElement.value = newValue;
        focusedElement.setSelectionRange(start, start);
    } else if (start > 0) {
        // Delete character before cursor
        const newValue = currentValue.substring(0, start - 1) + currentValue.substring(start);
        focusedElement.value = newValue;
        focusedElement.setSelectionRange(start - 1, start - 1);
    }
    
    focusedElement.scrollLeft = focusedElement.scrollWidth;
    focusedElement.dispatchEvent(new Event('input', { bubbles: true }));
}

function insertNewLine() {
    const focusedElement = document.activeElement;
    if (!isTextBox(focusedElement)) return;
    
    if (focusedElement.tagName.toLowerCase() === 'textarea') {
        insertText('\n');
    } else {
        // For input fields, trigger form submission or blur
        const form = focusedElement.closest('form');
        if (form) {
            form.dispatchEvent(new Event('submit', { bubbles: true }));
        } else {
            focusedElement.blur();
        }
    }
}

function toggleShift() {
    if (currentLayout !== 'letters') return;
    
    isShiftPressed = !isShiftPressed;
    generateKeyboard();
    bindKeyEvents();
    
    // REMOVED: The automatic timeout that was causing the issue
    // No automatic release - shift will only be released when a character key is pressed
}

function handleDoubleShift() {
    if (currentLayout !== 'letters') return;
    
    isCapsLock = !isCapsLock;
    isShiftPressed = isCapsLock;
    generateKeyboard();
    bindKeyEvents();
}

function bindKeyEvents() {
    $('.keyboard').off('mousedown');
    $('.keyboard .key').off('mousedown click');
    
    $('.keyboard').on('mousedown', e => {
        e.preventDefault();
    });

    let shiftTimeout;
    let shiftClickCount = 0;

    $('.keyboard .key').on('mousedown', e => {
        e.preventDefault();
        const target = e.currentTarget;
        const keyId = target.id;
        const keyData = target.getAttribute('data-key');
        
        // Add visual feedback
        $(target).addClass('pressed');
        setTimeout(() => $(target).removeClass('pressed'), 150);
        
        switch (keyId) {
            case 'shiftKey':
                shiftClickCount++;
                clearTimeout(shiftTimeout);
                
                if (shiftClickCount === 1) {
                    shiftTimeout = setTimeout(() => {
                        toggleShift();
                        shiftClickCount = 0;
                    }, 300);
                } else if (shiftClickCount === 2) {
                    clearTimeout(shiftTimeout);
                    handleDoubleShift();
                    shiftClickCount = 0;
                }
                break;
                
            case 'backspaceKey':
                deleteText();
                break;
                
            case 'enterKey':
                insertNewLine();
                break;
                
            case 'spaceKey':
                insertText(' ');
                // Reset shift after space if it was a single press (not caps lock)
                if (isShiftPressed && !isCapsLock && currentLayout === 'letters') {
                    isShiftPressed = false;
                    generateKeyboard();
                    bindKeyEvents();
                }
                break;
                
            case 'numbersKey':
                switchLayout('numbers');
                break;
                
            case 'lettersKey':
                switchLayout('letters');
                break;
                
            case 'symbolsKey':
                switchLayout('symbols');
                break;
                
            default:
                if (keyData) {
                    let textToInsert = keyData;
                    
                    if (currentLayout === 'letters' && (isShiftPressed || isCapsLock)) {
                        textToInsert = shiftMap[keyData] || keyData.toUpperCase();
                    }
                    
                    insertText(textToInsert);
                    
                    // Reset shift ONLY after a character key is pressed and only if it's not caps lock
                    if (isShiftPressed && !isCapsLock && currentLayout === 'letters') {
                        isShiftPressed = false;
                        generateKeyboard();
                        bindKeyEvents();
                    }
                }
                break;
        }
    });
}

function isTextBox(element) {
    if (!element) return false;
    
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'textarea') return true;
    if (tagName !== 'input') return false;
    
    const type = (element.getAttribute('type') || 'text').toLowerCase();
    const inputTypes = ['text', 'password', 'number', 'email', 'tel', 'url', 'search', 'date', 'datetime', 'datetime-local', 'time', 'month', 'week'];
    return inputTypes.indexOf(type) >= 0;
}

function closeKeyboard() {
    $(document.activeElement).blur();
}

// Initialize keyboard
function initKeyboard() {
    generateKeyboard();
    bindKeyEvents();
    updateKeyboardTargets();
    setInterval(updateKeyboardTargets, 500);
}

// Start when document is ready
$(document).ready(function() {
    initKeyboard();
});

// Physical keyboard support
$(document).on('keydown', function(e) {
    if (!$('.bodyWrapper').hasClass('keyboardActive')) return;
    
    // Prevent physical keyboard when virtual keyboard is active
    if (isTextBox(document.activeElement)) {
        // Allow some essential keys
        const allowedKeys = ['Tab', 'Escape', 'F5', 'F12'];
        if (!allowedKeys.includes(e.key) && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
        }
    }
});