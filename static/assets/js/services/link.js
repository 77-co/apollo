const integrations = {
    'google': {},
    'spotify': {}
};
let activeIntegrationLogin = '';

class Integration {
    constructor(integrationName) {
        this.integrationName = integrationName;
    }

    unlinkIntegration() {
        this._integrationLoggedInSet(false);
    }

    onIntegrationUnlink(callback) {

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

function integrationHandle(integrationName) {
    if (integrations[integrationName].active) {
        // handle unlinking integration
        return
    }

    activeIntegrationLogin = integrationName;

    $('#linkLoginQRCode').attr('src', integrations[integrationName]?.qrcode);
    $('#linkLoginAlert').addClass('active');
}



function closeAuth() {
    $('#linkLoginAlert').removeClass('active');
}