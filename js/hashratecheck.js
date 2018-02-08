
var worker;
var shareValue = null;
var running = false;
var baseVal = null;
var lastVal = 0;
var sharevals = false;
var minerBaseShares = null;
var startTime = null;
var testTimer = null;

var testShareCount = null;
var testShareVals = null;
var testDifficulty = null;

var message = function (message, busy) {
    if (busy) {
        $('#busy').show();
    } else {
        $('#busy').hide();
    }

    $('#status').text(message);
};

var showHashrate = function (hashrate) {
    message('Running test - Estimated hashrate: ' + (Math.floor(hashrate / 100) / 10) + ' kH/s...', true);
};

var updateData = function () {
    var seconds = Math.round(Date.now() / 1000 - startTime);
    var testShares = sharevals ? testShareVals : testShareCount;
    var result = Math.round(testShareVals / seconds * 65536);

    $('#curseconds').text(seconds);
    $('#curminershares').text(minerBaseShares + testShares);
    $('#calc').text('(' + (minerBaseShares + testShares) + ' - ' + minerBaseShares + ') shares ' + (sharevals ? '' : ('* ' + testDifficulty + ' ')) + '/ ' + seconds + ' seconds * 2^16 = ' + result + ' H/s');
    showHashrate(result);
};

var processShares = function (newShares, totalShares, difficulty) {
    $('#curminershares').text(totalShares * (sharevals ? difficulty : 1));
    testShareCount = totalShares;
    testShareVals = totalShares * difficulty;
    testDifficulty = difficulty;

    updateData();
};

var setup = function () {
    $('#input').show();
};

var start = function () {
    sharevals = $('#sval').prop('checked');
    minerBaseShares = parseInt($('#curshares').val());

    if (minerBaseShares == null || isNaN(minerBaseShares)) {
        alert('Please fill in the shares currently reported by your mining software.');
        return;
    }

    $('#input').hide();
    $('#data').show();

    baseVal = lastVal;
    testShareCount = 0;
    testShareVals = 0;
    running = true;
    startTime = Date.now() / 1000;
    showHashrate(0);

    testTimer = setInterval(updateData, 2000);
    processShares(0, 0, 0);
};

var reset = function () {
    $('#data').hide();
    $('#input').hide();

    clearInterval(testTimer);
    running = false;
};

var init = function () {
    worker = document.URL.split('?')[1];
    var resetVal = 0;

    var eventSource = new EventSource('/api/hashratecheck/' + worker);

    message('Synchronizing with worker - Connecting to pool...', true);

    eventSource.onmessage = function(event) {
        var newShares = Math.round(JSON.parse(event.data).shares);

        console.log('Worker [' + worker + ']: Shares: ' + newShares);

        if (baseVal == null) {
            lastVal = baseVal = newShares;
            message('Synchronizing with worker - Determining share difficulty...', true);
            return;
        }

        newShares += resetVal;

        if (newShares < lastVal) {
            newShares += lastVal - resetVal;
            resetVal = lastVal;
        }

        var totalShares = newShares - baseVal;
        newShares -= lastVal;
        lastVal += newShares;

        newShares = Math.round(newShares);
        console.debug(totalShares, newShares, lastVal, baseVal, shareValue);

        if (shareValue == null) {
            if (newShares == 96 || newShares == 512) {
                shareValue = newShares;
                message('Ready. Please enter details below.', false);
                setup();
            } else if ((newShares % 32) != 0) {
                message('Please connect your worker to port 3334 (for normal GPU mining) or 3335 (for multi-GPU mining rigs)', false);
            }
        } else if (Math.floor(newShares / shareValue) != newShares / shareValue) {
            message('Please connect your worker to port 3334 (for normal GPU mining) or 3335 (for multi-GPU mining rigs)', false);
            reset();
        } else {
            newShares /= shareValue;
            totalShares /= shareValue;
            console.log('New shares: ' + newShares + ', total shares: ' + totalShares + ', difficulty: ' + shareValue);

            if (running) {
                processShares(newShares, totalShares, shareValue)
            }
        }
    };

    $('#go').click(start);
    $('#data').hide();
    $('#input').hide();
};
