/* 
    Dialogue 0.0.1
    © 2024 77
*/

let dialogueContainer;
document.addEventListener('DOMContentLoaded', () => {
    dialogueContainer = document.querySelector('div.dialogueContainer');
    if (!dialogueContainer) {
        dialogueContainer = document.createElement('div');
        dialogueContainer.classList.add('dialogueContainer');
        document.body.appendChild(dialogueContainer);
    }

    dialogueContainer.addEventListener('click', (e) => {
        if (e.target === dialogueContainer)
            destroyAllDialogues();
    });

    // Example below
    // setTimeout(() => {
    //     const dial = new Dialogue("Wymagana autoryzacja", "Musisz podać hasło, aby Apollo mógł przyłączyć się do sieci Wi-Fi.");
    //     dial.setContentHTML(`<h3>ZSL_GOSC</h3><input type='text' placeholder='Hasło'><p>Sieć używa zabezpieczeń WPA2</p>`);
    //     dial.setDialogButtons([
    //         {
    //             type: 'alternative',
    //             value: 'Anuluj',
    //             onclick: () => {
    //                 dial.destroy();
    //             }
    //         },
    //         {
    //             type: 'default',
    //             value: 'Połącz',
    //             onclick: () => {
    //                 dial.useTransition(() => {
    //                     dial.setContentHTML('');
    //                     dial.setTitle('Łączenie...');
    //                     dial.setDescription('Prosimy czekać');
    //                     dial.setDialogButtons([]);
    //                 });
    //             }
    //         }
    //     ]);
    // }, 1500);
});

const dialogues = [];
class Dialogue {
    constructor(title = '', description = '') {
        // Create the main container
        this.dialogue = document.createElement('div');
        this.dialogue.classList.add('dialogue');

        // Create the header section
        this.header = document.createElement('div');
        this.header.classList.add('header');

        this.title = document.createElement('span');
        this.title.classList.add('title');
        this.title.textContent = title;

        this.description = document.createElement('span');
        this.description.classList.add('description');
        this.description.textContent = description;

        this.header.appendChild(this.title);
        this.header.appendChild(this.description);

        // Create the content section
        this.content = document.createElement('div');
        this.content.classList.add('content');

        // Create the footer section
        this.footer = document.createElement('div');
        this.footer.classList.add('footer');

        // Append all sections to the main dialogue container
        this.dialogue.appendChild(this.header);
        this.dialogue.appendChild(this.content);
        this.dialogue.appendChild(this.footer);

        // Add the dialogue to the body
        dialogueContainer.appendChild(this.dialogue);
        dialogueContainer.classList.add('active');

        dialogues.push(this);
    }

    // This method allows for modifying the dialogue content in a form of a transition.
    // The callback is ran after the dialogue disappears. It appears back after the callback finishes.
    useTransition(callback) {
        anime({
            targets: this.dialogue,
            translateX: [0, -50],
            opacity: [1, 0],
            easing: 'easeInSine',
            duration: 250,
            complete: () => {
                callback();
                anime({
                    targets: this.dialogue,
                    translateX: [50, 0],
                    opacity: [0, 1],
                    easing: 'easeOutSine',
                    duration: 250,
                });
            }
        });
    }

    // Sets the title of the dialogue menu
    setTitle(value = '') {
        this.title.innerText = value;
    }

    // Sets the description of the dialogue menu
    setDescription(value = '') {
        this.description.innerText = value;
    }

    setContentHTML(value = '') {
        this.content.innerHTML = value;
    }

    setDialogButtons(buttons = []) {
        this.footer.innerHTML = '';
        buttons.forEach(button => {
            const btn = document.createElement('button');
            switch (button.type) {
                case 'default':
                    btn.classList.add('default');
                    break;

                case 'alternative':
                    btn.classList.add('alternative');
                    break;
            
                default:
                    break;
            }

            btn.onclick = button.onclick;

            btn.innerText = button.value;
            this.footer.appendChild(btn);
        });
    }

    // This method closes and destroys the dialogue menu
    destroy() {
        anime({
            targets: this.dialogue,
            translateY: [0, -50],
            opacity: [1, 0],
            easing: 'easeOutSine',
            duration: 200,
            complete: () => {
                this.dialogue.remove();
                if (dialogueContainer.children.length === 0) {
                    dialogueContainer.classList.remove('active');
                }
            }
        });

        delete this;
    }
}

function destroyAllDialogues() {
    dialogues.forEach(dialogue => {
        dialogue.destroy();
    });
}