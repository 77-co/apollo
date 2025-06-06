const integrations = {
    'google': {},
    'spotify': {}
};
let activeIntegrationLogin = '';

class Integration {
    constructor(integrationName, unlinkHandler = () => undefined) {
        this.integrationName = integrationName;
        this._unlinkHandler = unlinkHandler;

        const button = document.getElementById(`${integrationName}LinkButton`);
        if (button) button.addEventListener('click', () => this._buttonHandler(this));
    }

    // In this function we need to replace 'this' with an argument, because when using it as a handler, this could be overwritten by the element it's linked to.
    _buttonHandler(classObject) {
        if (integrations[classObject.integrationName]?.active) {
            // handle unlinking integration
            classObject.unlinkIntegration();
            return;
        }

        console.log(integrations);

        activeIntegrationLogin = classObject.integrationName;
        $('#linkLoginQRCode').attr('src', integrations[classObject.integrationName]?.qrcode);
        $('#linkLoginAlert').addClass('active');
    }

    unlinkIntegration() {
        this._integrationLoggedInSet(false);
        this._unlinkHandler();
    }

    _integrationLoggedInSet(value) {
        integrations[this.integrationName].active = value;

        if (value) {
            $(`#${this.integrationName}LinkButton`).addClass('danger');
            $(`#${this.integrationName}LinkButton`).text('Rozłącz');
        } else {
            $(`#${this.integrationName}LinkButton`).removeClass('danger');
            $(`#${this.integrationName}LinkButton`).text('Połącz');
        }
    }

    confirmLogin() {
        console.log('login');
        if (this.integrationName === activeIntegrationLogin)
            $('#linkQrBlur').addClass('active');
    }

    finaliseLogin() {
        if (this.integrationName === activeIntegrationLogin)
            $('#linkLoginAlert').removeClass('active');
        this._integrationLoggedInSet(true);
    }
}



function closeAuth() {
    $('#linkLoginAlert').removeClass('active');
}

window.addEventListener("ready", () => {
    closeAuth();
});