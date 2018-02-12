var blocks = {};
var workerHashrate = {};
var workerAddressMap = {};
var luckInfo = [];
var myAddress = null;
var currentWorker = null;

var setAddress = function(id, address) {
    var $target = $(id);
    var $parent = $target.parent();
    var linkIcon = '<span style="color: #777;">&#x2197;</span>';

    $target.text(address);
    $target.attr('href', (address.substring(0, 1) == 'G' ? 'https://garlicinsight.com/address/' : 'https://garli.co.in/address/') + address);
    $parent.html($parent.html() + linkIcon);
};

var setAddressHashrate = function (query, hashrate) {
    if (hashrate === null || hashrate === undefined || isNaN(hashrate)) {
        hashrate = '--';
    } else {
        hashrate = Math.round(hashrate / 100) / 10;
    }
    $(query).text(hashrate + ' kH/s');
};

var setCbOutputs = function (data) {
    $('.cbouttx').remove();
    $.each(data.sort(function (a, b) {
        return a.reward < b.reward ? 1 : -1;
    }), function (i, output) {
        var prefix = 'cbouttxrow' + i;
        var html =  '<tr class="cbouttx" id="' + prefix + '">' +
                        '<td><a class="mono" href="" target="_blank" id="' + prefix + 'addr"></a></td>' +
                        '<td id="' + prefix + 'reward"></td>' +
                        '<td id="' + prefix + 'pct"></td>' +
                        '<td id="' + prefix + 'shares"></td>' +
                        '<td id="hashrate' + output.address + '"></td>' +
                    '</tr>';
        $('#cbout').append(html);
        setAddress('#' + prefix + 'addr', output.address);
        $('#' + prefix + 'reward').text(Math.floor(output.reward) / 100000000);
        $('#' + prefix + 'pct').text(output.percentage + '%');
        $('#' + prefix + 'shares').text(Math.floor(parseFloat(output.shares) * 100)/100);

        var workerAddress = workerAddressMap[output.address] != null ? workerAddressMap[output.address] : output.address;

        setAddressHashrate('#hashrate' + output.address, workerHashrate[workerAddress] != null ? workerHashrate[workerAddress].average : 0);
    });
};

var _showWorker = function (address) {
    var setDailyPayoutWorker = function(dailyPayout) {
        if (dailyPayout) {
            $('.instantpayoutworker').hide();
            $('.dailypayoutworker').show();
        }  else {
            $('.dailypayoutworker').hide();
            $('.instantpayoutworker').show();
        }
    };

    if (address == myAddress) {
        $('#genericworkerheader').hide();
        $('#myworkerheader').show();
    } else {
        $('#genericworkerheader').show();
        $('#myworkerheader').hide();
    }
    if (address == null) {
        $('#nomyworker').show();
        $('#workerinfo').hide();
    } else {
        currentWorker = address;
        $('#nomyworker').hide();
        $('#workerinfo').show();
    }
    $('.currentworker').text(address);

    setDailyPayoutWorker(false);

    $('.worker-solved').remove();
    $('.workerinfo-info').text('');
    $('#workerinfo_check_hashrate_cont').hide();

    if (address != null) {
        setAddress('#workerinfo_address', address);

        $.ajax({
            type:   'GET',
            url:    '/api/workerinfo/' + address,
            contentType: "application/json",
            dataType: 'json',
            success: function (data, textStatus, jqXHR) {
                if (data != null && data != '') {
                    var dailyPayout = address != data.nextpayout.address && data.nextpayout.address != null && data.nextpayout.address != '';

                    setDailyPayoutWorker(dailyPayout);

                    $('#workerinfo_payout_type').text(dailyPayout ? 'Daily' : 'Instant');
                    $('#workerinfo_payout').text('' + data.nextpayout.grlc + ' GRLC');
                    $('#workerinfo_validsharepercent').text('' + (Math.round(data.shares.valid / (data.shares.valid + data.shares.invalid) * 1000) / 10) + ' %');
                    $('#workerinfo_blocks').text('' + data.foundblocks.length);

                    setAddress('#workerinfo_consolidationaddress', data.nextpayout.address);

                    setAddressHashrate('#workerinfo_hashrate_avg', data.hashrate);
                    setAddressHashrate('#workerinfo_hashrate_cur', data.curhashrate);

                    if (address == myAddress) {
                        $('#workerinfo_check_hashrate_cont').show();
                        $('#workerinfo_check_hashrate').attr('href', 'hashratecheck/?' + address);
                    }

                    var date = new Date(0);
                    date.setUTCSeconds(data.lastseen);
                    $('#workerinfo_lastseen').text(date);

                    $('.worker-solved').remove();
                    $.each(data.foundblocks, function (i, block) {
                        var prefix = 'foundblockrow' + i;
                        var html =  '<tr class="worker-solved" id="' + prefix + '">' +
                                        '<td><a class="mono" href="" target="_blank" id="' + prefix + 'height"></a></td>' +
                                    '</tr>';
                        $('#workerinfo_blockslist').append(html);
                        $('#' + prefix + 'height').text(block);
                        $('#' + prefix + 'height').attr("href", 'https://garlicinsight.com/block-index/' + block);
                    });

                    if (!dailyPayout) {
                        $('#workerinfo_consolidated').text('N/A');
                    } else {
                        $.ajax({
                            type:   'GET',
                            url:    'https://garli.co.in/ext/getaddress/' + data.nextpayout.address,
                            contentType: "application/json",
                            dataType: 'json',
                            success: function (data, textStatus, jqXHR) {
                                if (data.balance != null) {
                                    setAddress('#workerinfo_consolidated', '' + data.balance + GRLC);
                                }
                            }
                        });
                    }
                }
            }
        });
    }
};

var refreshWorker = function () {
    _showWorker(currentWorker);
};

var setAsMyWorker = function () {
    myAddress = currentWorker;
    localStorage.setItem('myAddress', myAddress);
    selectMenu('myworker');
};

var showWorker = function (address) {
    if (address == myAddress) {
        selectMenu('myworker');
        return;
    }

    $('.contentdiv').hide();
    $('#content-myworker').show();
    _showWorker(address);
};

var buildWorkerList = function (data) {
    var asList = [];

    $('.workerentry').remove();

    $.each(data, function (address, hashrate) {
        asList.push({ 'address': address, 'hashrate': hashrate.average });
    });

    $.each(asList.sort(function (a, b) {
        return a.hashrate < b.hashrate ? 1 : -1;
    }), function (i, output) {
        var prefix = 'worker' + i;
        var html =  '<tr class="workerentry" id="' + prefix + '">' +
                        '<td><a class="mono workerlink" href="#" id="' + prefix + 'addr"></a></td>' +
                        '<td id="' + prefix + 'rate"></td>' +
                    '</tr>';
        $('#workerslist').append(html);
        $('#' + prefix + 'addr').text(output.address);
        setAddressHashrate('#' + prefix + 'rate', output.hashrate);
    });
    $('.workerlink').click(function (event) {
        showWorker($(event.target).text());
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
        var html = '<tr class="blkheight" id="' + prefix + '"><td class="blkheight-blk"><a href="#" target="_blank" id="' + prefix + 'nr"></a></td><td><a class="blockheight" href="#" id="' + prefix + 'miner"></a></td></tr>';
        $('#blks').append(html);
        $('#' + prefix + 'nr').text(height);
        $('#' + prefix + 'nr').attr("href", 'https://garlicinsight.com/block-index/' + height);
        $('#' + prefix + 'miner').text(blocks[height]);
        $('#' + prefix + 'miner').click(function () {
            showWorker(blocks[height]);
        });
    });
};

var setCurrentBlock = function (height) {
    $('.currentblock').text(height);
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
    $('.globalhashrate').text('' + pretty + ' MH/s');
};

var setPoolHashrate = function (hashrate, networkHashrate) {
    var pretty = Math.floor(hashrate / 10000) / 100;
    $('.poolhashrate').text('' + pretty + ' MH/s');

    var percent = Math.floor(hashrate / networkHashrate * 1000) / 10;
    $('.poolhashratepercent').text('' + percent + ' %');
};

var setWorkers = function (workers) {
    $('.workers').text('' + workers);
};

var getAndSetLuckInfo = function () {
    $.ajax({
        type:   'GET',
        url:    '/api/luck/',
        contentType: "application/json",
        dataType: 'json',
        success: function (data, textStatus, jqXHR) {
            if (data != null && data != '') {
                luckInfo = data;

                var periods = 0;
                var totalLuck = 0;

                for (var i in luckInfo) {
                    periods++;
                    totalLuck += luckInfo[i].luck;
                }

                var luckAverage = Math.floor(totalLuck / periods * 1000) / 10;

                $('.poolluck').text('' + luckAverage + ' %');

                drawLuckGraphs(luckInfo, luckAverage);
            }
        }
    });
};

var selectMenu = function (id) {
    var contentDiv = '#content-' + id;

    $('.menuitem').removeClass('selected');
    $('#' + id).addClass('selected');

    $('.contentdiv').hide();
    $(contentDiv).show();

    if (id == 'myworker') {
        _showWorker(myAddress);
    } else if (id == 'stats') {
        getAndSetLuckInfo();
    }
};

var drawLuckGraphs = function (data, average) {
    var blocksVsHashrateSeries = [];
    var luckSeries = [];

    blocksVsHashrateSeries.push({
        'name': 'Hashrate',
        'data': []
    });
    blocksVsHashrateSeries.push({
        'name': 'Solved blocks',
        'data': []
    });

    luckSeries.push({
        'name': 'Pool\'s luck',
        'data': []
    });

    $.each(data, function (i, entry) {
        blocksVsHashrateSeries[0].data.push([ entry.startBlock + 50, Math.floor(entry.hashratePercent * 1000) / 10 ]);
        blocksVsHashrateSeries[1].data.push([ entry.startBlock + 50, Math.floor(entry.blocksPercent * 1000) / 10 ]);

        luckSeries[0].data.push([ entry.startBlock + 50, Math.floor(entry.luck * 1000) / 10 ]);
    });

    $('#graph_blkhash').highcharts({
        title: {
            text: ''
        },
        xAxis: {
            title: {
                text: 'Block heights',
                style: {
                    color: '#aaaaaa',
                    fontSize: '16px'
                }
            },
            labels: {
                style: {
                    color: '#dddddd',
                    fontSize: '14px'
                }
            }
        },
        yAxis: {
            title: {
                text: 'Percentage',
                style: {
                    color: '#aaaaaa',
                    fontSize: '16px'
                }
            },
            min: 0,
            gridLineColor: '#333333',
            labels: {
                style: {
                    color: '#dddddd',
                    fontSize: '14px'
                }
            }
        },
        legend: {
            layout: 'vertical',
            align: 'right',
            verticalAlign: 'middle',
            borderWidth: 0,
            itemStyle: {
                fontSize: '16px',
                color: '#e58500',

            },
            itemHoverStyle:{
                color: '#e58500'
            }
        },
        tooltip: {
            formatter: function() {
                return '<b>' + this.series.name + '</b><br/><i>' + (this.x - 50) + '-' + (this.x + 50) + '</i>:   <b>' + this.y + ' %</b>';
            }
        },
        chart: {
            zoomType: 'x',
            backgroundColor: '#444',
            style: {
                color: "#e58500"
            }
        },
        plotOptions: {
            area: {
                lineWidth: 4,
                marker: {
                    enabled: false
                },
                shadow: false,
                states: {
                    hover: {
                        lineWidth: 8,
                    }
                },
                threshold: null
            },
            line: {
                lineWidth: 4,
                marker: {
                    enabled: false
                }
            }
        },
        colors: [ '#f31010', '#ffa517' ],
        series: blocksVsHashrateSeries
    });

    $('#graph_luck').highcharts({
        title: {
            text: ''
        },
        xAxis: {
            title: {
                text: 'Block heights',
                style: {
                    color: '#aaaaaa',
                    fontSize: '16px'
                }
            },
            labels: {
                style: {
                    color: '#dddddd',
                    fontSize: '14px'
                }
            }
        },
        yAxis: {
            title: {
                text: 'Percentage',
                style: {
                    color: '#aaaaaa',
                    fontSize: '16px'
                }
            },
            min: 0,
            gridLineColor: '#333333',
            labels: {
                style: {
                    color: '#dddddd',
                    fontSize: '14px'
                }
            },
            plotLines: [{
                value: average,
                color: '#aaaaaa',
                dashStyle: 'shortdash',
                width: 1,
                label: {
                    style: {
                        color: '#eeeeee'
                    },
                    text: '48-hour average (' + average + ' %)'
                }
            }]
        },
        legend: {
            layout: 'vertical',
            align: 'right',
            verticalAlign: 'middle',
            borderWidth: 0,
            itemStyle: {
                fontSize: '16px',
                color: '#e58500',

            },
            itemHoverStyle:{
                color: '#e58500'
            }
        },
        tooltip: {
            formatter: function() {
                return '<b>' + this.series.name + '</b><br/><i>' + (this.x - 50) + '-' + (this.x + 50) + '</i>:   <b>' + this.y + ' %</b>';
            }
        },
        chart: {
            zoomType: 'x',
            backgroundColor: '#444',
            style: {
                color: "#e58500"
            }
        },
        plotOptions: {
            area: {
                lineWidth: 4,
                marker: {
                    enabled: false
                },
                shadow: false,
                states: {
                    hover: {
                        lineWidth: 8,
                    }
                },
                threshold: null
            },
            line: {
                lineWidth: 4,
                marker: {
                    enabled: false
                }
            }
        },
        colors: [ '#ddd' ],
        series: luckSeries
    });
};

var init = function () {
    Highcharts.setOptions({
        lang: {
            numericSymbols: null
        },
        global: {
            useUTC: false
        }
    });

    myAddress = localStorage['myAddress'];

    $('.menuitem').click(function (event) {
        selectMenu($(event.target).attr('id'));
    });

    selectMenu('poolnews');

    $('#stratumurl1').text('stratum+tcp://freshgarlicblocks.net:3032');
    $('#stratumurl2').text('stratum+tcp://freshgarlicblocks.net:3333');
    $('#stratumurl3').text('stratum+tcp://freshgarlicblocks.net:3334');
    $('#stratumurl4').text('stratum+tcp://freshgarlicblocks.net:3335');
    $('#stratumurl5').text('stratum+tcp://freshgarlicblocks.net:3336');

    var eventSource = new EventSource('/api/getinfo');

    var poolHashrate = 0;
    var networkHashrate = 0;

    eventSource.onmessage = function(event) {
        var rawdata = JSON.parse(event.data);
        var type = Object.keys(rawdata)[0];
        var data = rawdata[type];

        console.debug('Received event: ', type, data);

        if (type == 'rpcinfo') {
            setCurrentBlock(data.blocks + 1);
            setGlobalHashrate(data.networkhashps);
            networkHashrate = data.networkhashps;
            setPoolHashrate(poolHashrate, networkHashrate);
        } else if (type == 'nextblock') {
            setCbOutputs(data);
        } else if (type == 'minedBy') {
            var height = Object.keys(data)[0];
            setBlockMinerInfo(height, data[height]);
        } else if (type == 'globalhashrate') {
            poolHashrate = data;
            setPoolHashrate(poolHashrate, networkHashrate);
        } else if (type == 'workerhashrates') {
            workerHashrate = data;
            var workers = 0;
            var addresses = Object.keys(data);
            for (var i in addresses) {
                var workerRate = workerHashrate[addresses[i]] != null ? workerHashrate[addresses[i]].average : 0;

                if (workerHashrate[addresses[i]].usedfor == null) {
                    setAddressHashrate('#hashrate' + addresses[i], workerRate);
                } else {
                    setAddressHashrate('#hashrate' + workerHashrate[addresses[i]].usedfor, workerRate);
                    workerAddressMap[workerHashrate[addresses[i]].usedfor] = addresses[i];
                }

                if (workerRate != null && !isNaN(workerRate) && workerRate > 0 && workerHashrate[addresses[i]].current > 0) {
                    workers++;
                }
            }

            setWorkers(workers);
            buildWorkerList(data);
        }
    };

    eventSource.onerror = function () {
        eventSource.close();
        $('#overlay').show();
    };

    getAndSetLuckInfo();
};
