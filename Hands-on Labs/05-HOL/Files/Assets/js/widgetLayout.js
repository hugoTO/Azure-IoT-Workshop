var connectDeviceList = {};
var temptureLineChart;
var humidityLineChart;
var temptureLineChartConfig = {
    type: 'line',
    data: {
        datasets: [],
        labels: []
    },
    options: {
        legend: {
            display: true
        },
        elements: {
            line: {
                tension: 0.5 // disables bezier curves
            },
            point: {
                radius: 0
            }
        },
        responsive: true,
        maintainAspectRatio: false
    }
};
var humidityLineChartConfig = {
    type: 'line',
    data: {
        datasets: [],
        labels: []
    },
    options: {
        legend: {
            display: true
        },
        elements: {
            line: {
                tension: 0.5 // disables bezier curves
            },
            point: {
                radius: 0
            }
        },
        responsive: true,
        maintainAspectRatio: false,
    }
};
var deviceColorArray = ['#ff5722', '#0091ee', '#1bc4a0', '#ff3dda']

/**
 * Get Random device line chart color
 */
function getRandomColor() {
    var letters = '0123456789ABCDEF';
    var colorCode = '#';
    for (var i = 0; i < 6; i++) {
        colorCode += letters[Math.floor(Math.random() * 16)];
    }
    return colorCode;
}

/**
 * Convert UTC Time to local Time
 */
function convertUTCTimeToLocalTime(utcTime) {
    var date = new Date(utcTime);
    var localTime = date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
    return localTime;
}

/**
 * Show Error or Success Message
 */
function showFeedback(type, feedbackText) {

    var $feedbackNotify = $('#feedback-notify');

    if (type === 'error') {
        $('#feedback-icon').removeClass('glyphicon-ok-sign').addClass('glyphicon-remove-sign');
        $feedbackNotify.removeClass('success-color').addClass('error-color');
    } else if (type === 'success') {
        $('#feedback-icon').removeClass('glyphicon-remove-sign').addClass('glyphicon-ok-sign');
        $feedbackNotify.removeClass('error-color').addClass('success-color');
    }

    $('#feedback-text').text(feedbackText);
    $feedbackNotify.fadeIn('fast');
    setTimeout(function () { $feedbackNotify.fadeOut(); }, 3000);
}

/**
 * Init line chart setting
 */
function initLineChart() {
    //tempture lineChart
    var temptureLinectx = document.getElementById('line-chart-tempture').getContext('2d');
    Chart.defaults.global.defaultFontColor = '#FFF';
    temptureLineChart = new Chart(temptureLinectx, temptureLineChartConfig);

    //humidity lineChart
    var humidityLinectx = document.getElementById('line-chart-humidity').getContext('2d');
    Chart.defaults.global.defaultFontColor = '#FFF';
    humidityLineChart = new Chart(humidityLinectx, humidityLineChartConfig);
}

/**
 * Init alarm rule slider setting
 */
function initSlider() {

    var update_handle_track_pos = function (slider, ui_handle_pos) {
        var handle_track_xoffset, slider_range_inverse_width;
        handle_track_xoffset = -((ui_handle_pos / 100) * slider.clientWidth);
        $(slider).find(".handle-track").css("left", handle_track_xoffset);
        slider_range_inverse_width = (100 - ui_handle_pos) + "%";
        return $(slider).find(".slider-range-inverse").css("width", slider_range_inverse_width);
    };

    var setInitValue = function (initValue) {
        $('#new-temperature-rule').data('value', initValue).text(initValue);

        $("#js-slider").slider({
            range: "min", max: 100, value: initValue, create: function (event, ui) {
                var slider;
                slider = $(event.target);
                slider.find('.ui-slider-handle').append('<span class="dot"><span class="handle-track"></span></span>');
                slider.prepend('<div class="slider-range-inverse"></div>');
                slider.find(".handle-track").css("width", event.target.clientWidth);
                return update_handle_track_pos(event.target, $(this).slider("value"));
            },
            slide: function (event, ui) {
                $('#new-temperature-rule').text(ui.value).data('value', ui.value);
                return update_handle_track_pos(event.target, ui.value);
            }
        });

    };

    $.ajax({
        type: "GET",
        contentType: 'application/x-www-form-urlencoded; charset=utf-8',
        url: 'Settings/GetAlarmRules',
        error: function () {
            setInitValue(40);
        },
        success: function (data) {
            try {
                var ruleObj = $.parseJSON(data);
                for (var i = 0; i < ruleObj.length; i++) {
                    if (ruleObj[i].SensorType === "thermometer") {
                        setInitValue(ruleObj[i].TemperatureThreshold);
                        return false;
                    }
                }
                setInitValue(40);
            }
            catch (e) {
                setInitValue(40);
            }
        }
    });
}

/**
 * init event listener
 */
function eventBinding() {
    $("#alarm-switcher").click(function () {
        if ($('.main-page').hasClass('alarm-open')) {
            $('.main-page').removeClass('alarm-open');
            $('.alarm-list').removeClass('alarm-open');
        } else {
            $('.main-page').addClass('alarm-open');
            $('.alarm-list').addClass('alarm-open');
        }
    });

    $('#device-connect-content-wrapper').on('change', '.on-off-checker', function () {

        var isChecked = this.checked;
        var currentDeviceID = $(this).data('id');
        var onoff = isChecked ? "On" : "Off";

        $.ajax({
            type: "GET",
            contentType: 'application/x-www-form-urlencoded; charset=utf-8',
            url: 'Settings/EnableDevice',
            data: { 'deviceId': currentDeviceID, 'on': isChecked },
            error: function () {
                showFeedback('error', 'Turn ' + onoff + ' Device Failed');
            },
            success: function () {
                showFeedback('success', 'Turn ' + onoff + ' Device Success');
            }
        });
    });

    $('#send-new-rule-command').click(function () {

        var newAlarmRule = $("#new-temperature-rule").data('value');

        $.ajax({
            type: "GET",
            contentType: 'application/x-www-form-urlencoded; charset=utf-8',
            url: 'Settings/ApplyDeviceRules',
            data: { 'temperature': newAlarmRule },
            error: function () {
                showFeedback('error', 'Set Alert Rule Failed');
            },
            success: function () {
                showFeedback('success', 'The Device Rules Has Changed');
            }
        });

    });

    $('#alarm-filter-select').on('change', function () {

        var filterDevcieId = $(this).val();
        if (filterDevcieId === 'All') {
            $('.alarm-row').removeClass('filter-hide');

        } else {
            $('.alarm-row').each(function () {
                if ($(this).hasClass('filter-' + filterDevcieId)) {
                    $(this).removeClass('filter-hide');
                } else {
                    $(this).addClass('filter-hide');
                }
            });
        }
    });
}

/**
 * Append alarm message while receiving alarm
 */
function appendAlarmBlock(alarmMessage) {

    var filterDeviceID = $('#alarm-filter-select').val();

    var appendClass = (filterDeviceID !== 'All' && filterDeviceID !== alarmMessage.ioTHubDeviceID) ? ' filter-hide' : '';

    var createAlarmHtml = '<div class="alarm-row filter-' + alarmMessage.ioTHubDeviceID + appendClass + '">' +
        '<div class="alarm-icon-wrapper col-lg-2 col-md-2 col-sm-2 col-xs-2">' +
        '<span class="alarm-icon glyphicon glyphicon-wrench warning-color"></span>' +
        '</div>' +

        '<div class="col-lg-10 col-md-10 col-sm-10 col-xs-10">' +
        '<h4 class="warning-color alarm-title">Temperature Alert</h4>' +
        '<hr>' +
        '<div class="alarm-entry">Device ID : ' + alarmMessage.ioTHubDeviceID + '</div>' +
        '<div class="alarm-entry">Detected Value : ' + alarmMessage.reading + '℃</div>' +
        '<div class="alarm-entry">Threshold : ' + alarmMessage.threshold + '℃</div>' +
        '<div class="alarm-entry alarm-time">' + convertUTCTimeToLocalTime(alarmMessage.createdAt) + '</div>' +
        '</div>' +
        '</div>';

    $('.alarm-row-wrapper').prepend(createAlarmHtml);

    var currentAlarmNumber = parseInt($('#alarm-number-icon').text());
    var newAlarmValue = currentAlarmNumber + 1;

    $('#alarm-number-icon').text(newAlarmValue);
    if (newAlarmValue > 0) {
        $('#alarm-number-icon').show();
    }
}

/**
 * Update line chart while receiving telemetry data
 */
function updateLineChart(telemetryObject) {

    var updateTemperature = telemetryObject.temperature;
    var updateHumidity = telemetryObject.humidity
    var deleteOneHistroyRecord = false;

    // prevent dataset over 30
    if (temptureLineChartConfig.data.datasets[0].data.length > 30) {
        deleteOneHistroyRecord = true;
        temptureLineChartConfig.data.labels.splice(0, 1);
        humidityLineChartConfig.data.labels.splice(0, 1);
    }

    temptureLineChartConfig.data.labels.push(convertUTCTimeToLocalTime(telemetryObject.time));
    humidityLineChartConfig.data.labels.push(convertUTCTimeToLocalTime(telemetryObject.time));

    for (var i = 0; i < temptureLineChartConfig.data.datasets.length; i++) {

        if (deleteOneHistroyRecord) {
            temptureLineChartConfig.data.datasets[i].data.splice(0, 1);
            humidityLineChartConfig.data.datasets[i].data.splice(0, 1);
        }

        if (temptureLineChartConfig.data.datasets[i].label === telemetryObject.deviceId) {
            temptureLineChartConfig.data.datasets[i].data.push(updateTemperature);
            humidityLineChartConfig.data.datasets[i].data.push(updateHumidity);
        } else {
            temptureLineChartConfig.data.datasets[i].data.push(null);
            humidityLineChartConfig.data.datasets[i].data.push(null);
        }
    }
    temptureLineChart.update();
    humidityLineChart.update();
}

/**
 * Signal Light blink after receiving alarm or message 
 */
function signalLightBlink(deviceID, type) {

    //running signal
    if (type === 0) {
        $('#runnging-signal-' + deviceID).addClass('light-on');

        setTimeout(function () {
            $('#runnging-signal-' + deviceID).removeClass('light-on');
        }, 3000);
        // alarm signal
    } else if (type === 1) {
        $('#alarm-signal-' + deviceID).addClass('light-on');

        setTimeout(function () {
            $('#alarm-signal-' + deviceID).removeClass('light-on');
        }, 3000);
    }
}

/**
 * Update Widget when recieved telmetry data
 */
function updateWidget(telemetryObject) {

    if (!connectDeviceList[telemetryObject.deviceId]) {
        connectDeviceList[telemetryObject.deviceId] = true; //Register 

        var currentDataSetNum = temptureLineChartConfig.data.datasets.length;
        var deviceColor = (currentDataSetNum < 4) ? deviceColorArray[currentDataSetNum] : getRandomColor();

        var currentLabelLength = temptureLineChartConfig.data.labels.length;

        var temptureNewdata = [],
            humidityNewData = [];

        for (var i = 0; i < currentLabelLength; i++) {
            temptureNewdata[i] = null;
            humidityNewData[i] = null;
        }
        temptureNewdata.push(telemetryObject.temperature);
        humidityNewData.push(telemetryObject.humidity);

        //Create Tempture Data
        temptureLineChartConfig.data.datasets.push(
            {
                data: temptureNewdata,
                borderColor: deviceColor,
                fill: true,
                label: telemetryObject.deviceId,
                spanGaps: true,
                pointBorderWidth: 1,
                pointHoverRadius: 6,
                pointHoverBorderWidth: 1,
                pointRadius: 3,
                pointBackgroundColor: deviceColor,
                pointBorderColor: "white",
            }
        );

        temptureLineChartConfig.data.labels.push(convertUTCTimeToLocalTime(telemetryObject.time));

        //Create Humidity Data
        humidityLineChartConfig.data.datasets.push(
            {
                data: humidityNewData,
                borderColor: deviceColor,
                fill: true,
                label: telemetryObject.deviceId,
                spanGaps: true,
                pointBorderWidth: 1,
                pointHoverRadius: 6,
                pointHoverBorderWidth: 1,
                pointRadius: 3,
                pointBackgroundColor: deviceColor,
                pointBorderColor: "white",
            }
        );

        humidityLineChartConfig.data.labels.push(convertUTCTimeToLocalTime(telemetryObject.time));

        temptureLineChart.update();
        humidityLineChart.update();

        //Create Device StatusRow
        var creatDeviceRow = '<div class="device-row col-lg-12 col-md-12 col-sm-12 col-xs-12">' +
            '<div class="device-row-id-icon-wrapper col-lg-5 col-md-5 col-sm-5 col-xs-5">' +
            '<div class="device-row-icon-wrapper">' +
            '<span class="device-row-icon glyphicon glyphicon-hdd"></span>' +
            '</div>' +
            '<div class="device-row-id">' + telemetryObject.deviceId + '</div>' +
            '</div>' +

            '<div class="device-row-signal-wrapper col-lg-2 col-md-2 col-sm-2 col-xs-2">' +
            '<span id="runnging-signal-' + telemetryObject.deviceId + '" class="device-signal device-signal-running"></span>' +
            '</div>' +
            '<div class="device-row-signal-wrapper col-lg-2 col-md-2 col-sm-2 col-xs-2">' +
            '<span id="alarm-signal-' + telemetryObject.deviceId + '" class="device-signal device-signal-alarm"></span>' +
            '</div>' +
            '<div class="device-row-switcher col-lg-3 col-md-3 col-sm-3 col-xs-3">' +
            '<label class="switch">' +
            '<input data-id= "' + telemetryObject.deviceId + '" class="on-off-checker" type="checkbox" checked>' +
            '<span class="slider round"></span>' +
            '</label>' +
            '</div>' +
            '</div>';

        $('#device-connect-content-wrapper').append(creatDeviceRow);

        //add alarm filter
        $('#alarm-filter-select').append('<option>' + telemetryObject.deviceId + '</option>');

    } else {
        updateLineChart(telemetryObject);
        signalLightBlink(telemetryObject.deviceId, 0);
    }

}

/**
 * Update Alarm Widget when recieved alarm
 */
function updateAlarm(alarmMessage) {

    signalLightBlink(alarmMessage.ioTHubDeviceID, 1);
    appendAlarmBlock(alarmMessage);
}

$(document).ready(function () {
    initLineChart();
    initSlider();
    eventBinding();
}); 