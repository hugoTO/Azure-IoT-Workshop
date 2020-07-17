/**
 * signalRConnect - connection init
 */
function signalRConnect() {

    var chat;

    // Reference the auto-generated proxy for the hub.
    chat = $.connection.telemetryHub;
    $.connection.hub.start().done(function () {
        chat.server.hello();
    });

    // Create a function that the hub can call back to display telemetry messages.
    chat.client.sendTelemetry = function (telemetryObject) {

        updateWidget(telemetryObject);

    };

    // Create a function that the hub can call back to display alarm messages.
    chat.client.sendAlarmTelemetry = function (alarmMessage) {
        updateAlarm(alarmMessage);
    };
}


$(document).ready(function () {
    signalRConnect();
});

