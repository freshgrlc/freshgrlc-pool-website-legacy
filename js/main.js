var blocks = {};

var setCbOutputs = function (data) {
    $('.cbouttx').remove();
    $.each(data, function (i, output) {
        var prefix = 'cbouttxrow' + i;
        var html = '<tr class="cbouttx" id="' + prefix + '"><td><a class="mono" href="" id="' + prefix + 'addr"></a></td><td id="' + prefix + 'reward"></td><td id="' + prefix + 'pct"></td><td id="' + prefix + 'shares"></td></tr>';
        $('#cbout').append(html);
        $('#' + prefix + 'addr').text(output.address);
        $('#' + prefix + 'addr').attr("href", 'https://explorer.grlc-bakery.fun/address/' + output.address);
        $('#' + prefix + 'reward').text(Math.floor(output.reward) / 100000000);
        $('#' + prefix + 'pct').text(output.percent + '%');
        $('#' + prefix + 'shares').text(Math.floor(parseFloat(output.shares) * 100)/100);
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

var init = function () {
    $('#stratumurl').text('stratum+tcp://freshgarlicblocks.net:3032');

    new EventSource('/api/getinfo').onmessage = function(event) {
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
        }
    };
};
