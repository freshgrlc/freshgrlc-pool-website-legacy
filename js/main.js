var blocks = {};
var workerHashrate = {};

var setCbOutputs = function (data) {
    $('.cbouttx').remove();
    $.each(data.sort(function (a, b) {
        return a.reward < b.reward ? 1 : -1;
    }), function (i, output) {
        var prefix = 'cbouttxrow' + i;
        var html =  '<tr class="cbouttx" id="' + prefix + '">' +
                        '<td><a class="mono" href="" id="' + prefix + 'addr"></a></td>' +
                        '<td id="' + prefix + 'reward"></td>' +
                        '<td id="' + prefix + 'pct"></td>' +
                        '<td id="' + prefix + 'shares"></td>' +
                        '<td id="' + prefix + 'hashrate"></td>' +
                    '</tr>';
        $('#cbout').append(html);
        $('#' + prefix + 'addr').text(output.address);
        $('#' + prefix + 'addr').attr("href", 'https://explorer.grlc-bakery.fun/address/' + output.address);
        $('#' + prefix + 'reward').text(Math.floor(output.reward) / 100000000);
        $('#' + prefix + 'pct').text(output.percentage + '%');
        $('#' + prefix + 'shares').text(Math.floor(parseFloat(output.shares) * 100)/100);

        var hashrate = workerHashrate[output.address];
        if (hashrate === null || hashrate === undefined || isNaN(hashrate)) {
            hashrate = '--';
        } else {
            hashrate = Math.floor(hashrate / 100) / 10;
        }
        $('#' + prefix + 'hashrate').text(hashrate + ' kH/s');
    });
};

var redrawMinedBlocks = function () {
    $('.blkheight').remove();
    var ids = [];
    $.each(blocks, function (height) {
        ids.unshift(height);
    });
    $.each(ids, function (_, height) {
        var prefix = 'blk' + height;
        var html = '<tr class="blkheight" id="' + prefix + '"><td id="' + prefix + 'nr"></td><td id="' + prefix + 'miner"></td></tr>';
        $('#blks').append(html);
        $('#' + prefix + 'nr').text(height);
        $('#' + prefix + 'miner').text(blocks[height]);
    });
};

var setCurrentBlock = function (height) {
    $('#currentblock').text(height);
};

var addMinedBlock = function (height) {
    blocks[height] = '<no info>';
    redrawMinedBlocks();
};

var setBlockMinerInfo = function (height, miner) {
    blocks[height] = miner;
    redrawMinedBlocks();
};

var setGlobalHashrate = function (hashrate) {
    var pretty = Math.floor(hashrate / 10000) / 100;
    $('#globalhashrate').text('' + pretty + ' MH/s');
};

var setPoolHashrate = function (hashrate) {
    var pretty = Math.floor(hashrate / 10000) / 100;
    $('#poolhashrate').text('' + pretty + ' MH/s');
};

var init = function () {
    $('#stratumurl1').text('stratum+tcp://freshgarlicblocks.net:3032');
    $('#stratumurl2').text('stratum+tcp://freshgarlicblocks.net:3333');

    var eventSource = new EventSource('/api/getinfo');

    eventSource.onmessage = function(event) {
        var rawdata = JSON.parse(event.data);
        var type = Object.keys(rawdata)[0];
        var data = rawdata[type];

        console.debug('Received event: ', type, data);

        if (type == 'rpcinfo') {
            setCurrentBlock(data.blocks + 1);
            setGlobalHashrate(data.networkhashps);
        } else if (type == 'nextblock') {
            setCbOutputs(data);
        } else if (type == 'minedBy') {
            var height = Object.keys(data)[0];
            setBlockMinerInfo(height, data[height]);
        } else if (type == 'globalhashrate') {
            setPoolHashrate(data);
        } else if (type == 'workerhashrates') {
            workerHashrate = data;
        }
    };

    eventSource.onerror = function () {
        eventSource.close();
        $('#overlay').show();
    };
};
