var blocks = {};
var blockStatus = {};
var workerHashrate = {};
var workerAddressMap = {};
var luckInfo = [];
var myAddress = localStorage['myAddress'];
var currentWorker = null;
var curHeight = 0;
var redrawMinedBlocksTimeout = null;
var apiReqs = {};
var apiQueue = [];

var formatHashrate = function (hashrate) {
    if (!hashrate) {
        return '-';
    } else if (typeof(hashrate) == 'string') {
        hashrate = parseFloat(hashrate);
    }

    var suffix = 'H/s';
    if (hashrate >= 1e12) {
        suffix = 'TH/s';
        hashrate /= 1e12;
    }
    else if (hashrate >= 1e9) {
        suffix = 'GH/s';
        hashrate /= 1e9;
    }
    else if (hashrate >= 1e6) {
        suffix = 'MH/s';
        hashrate /= 1e6;
    }
    else if (hashrate >= 1e3) {
        suffix = 'kH/s';
        hashrate /= 1e3;
    }

    return hashrate.toFixed(2) + ' <span class="suffix">' + suffix + '</span>';
};

var formatDate = function (date) {
    return date.toLocaleString();
};

let callApi = (endpoint, param, options) => {
    let serializeOpts = options => {
        let serialized = '';
        for (let key in options) {
            if (serialized !== '') serialized += '&';
            serialized += key + '=' + options[key];
        }
        return serialized;
    };

    const url = 'https://api.freshgrlc.net/blockchain/grlc/' + endpoint + '/' + param + (options !== undefined ? '?' + serializeOpts(options) : '');

    if (apiReqs[url] !== undefined)
        return apiReqs[url];
    
    apiReqs[url] = new Promise((resolve, reject) => {
        let doAjax = () => $.ajax({
            type:     'GET',
            url:      url,
            dataType: 'json',
            success:  response => {
                apiQueue = apiQueue.filter(v => v !== apiReqs[url]);
                delete apiReqs[url];
                resolve(response)
            }
        });

        if (apiQueue.length === 0) {
            doAjax();
        } else {
            apiQueue[apiQueue.length - 1].then(response => doAjax());
        }
    });

    apiQueue.push(apiReqs[url]);
    return apiReqs[url];
};

let searchForObject = async (id, allowedObjects, options) => {
    let identifyObjectType = object => {
        return object.address !== undefined ? 'address' :
               object.height  !== undefined ? 'block'   :
               undefined;
    };

    const objectInfo = await callApi('search', id, options);
    return objectInfo === null || (allowedObjects !== undefined && allowedObjects.indexOf(identifyObjectType(objectInfo)) < 0) ? null : objectInfo;
};

var setAddress = function (id, address) {
    let $target = $(id);
    $target.text(address);
    $target.attr('href', 'https://explorer.freshgrlc.net/grlc/address/' + address);
};

var setBlockLink = function (id, height) {
    let $target = $(id);
    var realUrl = null;

    $target.text(height);
    $target.click(() => {
        if (realUrl)
            return true;

        searchForObject(height, 'block').then(info => {
            realUrl = 'https://explorer.freshgrlc.net/grlc/blocks/' + info.hash;
            $target.attr('href', realUrl);
            window.open(realUrl);
        });
        return false;
    });
};

var setAddressHashrate = function (query, hashrate) {
    $(query).html(formatHashrate(hashrate));
};

var setCbOutputs = function (data) {
    $('.cbouttx').remove();
    $.each(data.sort(function (a, b) {
        return a.reward < b.reward ? 1 : -1;
    }), function (i, output) {
        var prefix = 'cbouttxrow' + i;
        var html =  '<tr class="cbouttx" id="' + prefix + '">' +
                        '<td><a href="#" id="' + prefix + 'worker">' + output.address + '</a></td>' +
                        '<td class="numeric" id="' + prefix + 'reward"></td>' +
                        '<td class="numeric" id="' + prefix + 'pct"></td>' +
                        '<td class="numeric" id="' + prefix + 'shares"></td>' +
                        '<td class="numeric" id="hashrate' + output.address + '"></td>' +
                    '</tr>';
        $('#cbout').append(html);
        $('#' + prefix + 'reward').text(Math.floor(output.reward) / 100000000);
        $('#' + prefix + 'pct').text(output.percentage + '%');
        $('#' + prefix + 'shares').text(Math.floor(parseFloat(output.shares) * 100)/100);

        var workerAddress = workerAddressMap[output.address] != null ? workerAddressMap[output.address] : output.address;

        $('#' + prefix + 'worker').prop('href', '#' + workerAddress);

        if (workerAddress == myAddress) {
            $('#' + prefix).addClass('myworker');
        }

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

    if (address == null) {
        setAddress('#workerinfo_address', '', 'workerinfo-info');
    } else {
        setAddress('#workerinfo_address', address, 'workerinfo-info');

        $.ajax({
            type:   'GET',
            url:    '/api/workerinfo/' + address,
            contentType: "application/json",
            dataType: 'json',
            success: function (data, textStatus, jqXHR) {
                if (data != null && data != '') {
                    var online = data.hashrate > 0;
                    var dailyPayout = address != data.nextpayout.address && data.nextpayout.address != null && data.nextpayout.address != '';

                    setDailyPayoutWorker(dailyPayout);

                    if (online) {
                        $('#workerinfo_payout_type').text(dailyPayout ? 'Daily' : 'Instant');
                        $('#workerinfo_payout').html('' + data.nextpayout.grlc + ' <span class="suffix">GRLC</span>');
                        $('#workerinfo_validsharepercent').text('' + (Math.round(data.shares.valid / (data.shares.valid + data.shares.invalid) * 1000) / 10) + '%');
                    } else {
                        $('#workerinfo_payout_type').text('Offline');
                        $('#workerinfo_payout').html(' - ');
                        $('#workerinfo_validsharepercent').text(' - ');
                    }
                    $('#workerinfo_blocks').text('' + data.foundblocks.length);

                    setAddress('#workerinfo_consolidationaddress', data.nextpayout.address, 'workerinfo-info');

                    setAddressHashrate('#workerinfo_hashrate_avg', data.hashrate);
                    setAddressHashrate('#workerinfo_hashrate_cur', data.curhashrate);

                    if (online && address == myAddress) {
                        $('#workerinfo_check_hashrate_cont').show();
                        $('#workerinfo_check_hashrate').attr('href', 'hashratecheck/?' + address);
                    }

                    var date = new Date(0);
                    date.setUTCSeconds(data.lastseen);
                    $('#workerinfo_lastseen').text(formatDate(date));

                    $('.worker-name-hashrate').remove();
                    if (online) {
                        $.each(Object.keys(data.workershashrate).sort(), function (i, workername) {
                            var prefix = 'workernamehashrate' + i;
                            var html =  '<tr class="worker-name-hashrate" id="' + prefix + '">' +
                                            '<td id="' + prefix + 'name"></td>' +
                                            '<td id="' + prefix + 'currate"></td>' +
                                            '<td id="' + prefix + 'avgrate"></td>' +
                                        '</tr>';
                            $('#workerinfo_workerslist').append(html);
                            if (workername == '') {
                                $('#' + prefix).addClass('worker-name-none');
                            }
                            else {
                                $('#' + prefix + 'name').text(workername);
                            }
                            setAddressHashrate('#' + prefix + 'currate', data.workershashrate[workername].current);
                            setAddressHashrate('#' + prefix + 'avgrate', data.workershashrate[workername].average);
                        });
                    }

                    $('.worker-solved').remove();
                    $('#workerinfo_blockslist').toggle(data.foundblocks.length > 0);
                    $('#workerinfo_blockslist ul').empty();
                    $.each(data.foundblocks, function (i, block) {
                        var prefix = 'foundblockrow' + i;
                        var html =  '<li class="worker-solved" id="' + prefix + '">' +
                                        '<a href="" target="_blank" id="' + prefix + 'height"></a>' +
                                    '</li>\n';
                        $('#workerinfo_blockslist ul').append(html);
                        setBlockLink('#' + prefix + 'height', block);
                    });

                    if (online && dailyPayout) {
                        let payoutAddress = data.nextpayout.address;

                        callApi('address', payoutAddress + '/balance/').then(balance =>
                            $('#workerinfo_consolidated').html('' + (balance == null ? 0 : balance) + ' <span class="suffix">GRLC</span>')
                        );

                        callApi('address', payoutAddress + '/mutations/').then(mutations => {
                            var utxos = 0;
                            var utxoValue = 0.0;

                            for (let i in mutations) {
                                const mutation = mutations[i];
                                if (mutation.change > 0.0) {
                                    utxos++;
                                    utxoValue += mutation.change;
                                }
                            }

                            if (utxos > 0) {
                                var estimatedSize = (utxos * 76 + 7 + 34) * 1.457;
                                var estimatedFee = estimatedSize * 5.0 / 100000000.0;

                                $('#workerinfo_consolidatefee').text('' + (Math.round(estimatedFee / utxoValue * 1000000) / 10000) + '%');
                            } else {
                                $('#workerinfo_consolidatefee').text(' - ');
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
};

var showWorker = function (address) {
    if (address == myAddress) {
        location.hash = '#myworker';
    }
    else {
        location.hash = '#' + address;
    }
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
                        '<td><a class="workerlink" href="#" id="' + prefix + 'addr"></a></td>' +
                        '<td id="' + prefix + 'rate"></td>' +
                    '</tr>';
        $('#workerslist').append(html);
        $('#' + prefix + 'addr').text(output.address).attr('href', '#' + output.address);
        setAddressHashrate('#' + prefix + 'rate', output.hashrate);

        if (output.address == myAddress) {
            $('#' + prefix).addClass('myworker');
        }
    });
    $('.workerlink').click(function (event) {
        showWorker($(event.target).text());
    });
};

var redrawMinedBlocks = function () {
    let getBlockStatus = (height, cb) => {
        searchForObject(height, 'block', {expand: 'miner'}).then(block => 
            cb(block.miner !== undefined ? block.miner.name === 'FreshGRLC.net' ? 'confirmed' : 'orphaned' : 'error')
        );
    };

    $('.blkheight').remove();
    var ids = [];
    $.each(blocks, function (height) {
        ids.unshift(height);
    });
    $.each(ids, function (_, height) {
        var prefix = 'blk' + height;
        var html = '<tr class="blkheight" id="' + prefix + '"><td class="blkheight-blk"><a href="#" target="_blank" id="' + prefix + 'nr"></a></td><td><a class="blockheight" href="#' + blocks[height] + '">' + blocks[height] + '</a></td><td class="blkheight-status" id="' + prefix + 'status"></td></tr>';
        $('#blks').append(html);
        setBlockLink('#' + prefix + 'nr', height);
        if (curHeight == 0) {
            return;
        }
        if (blockStatus[height] == null || (blockStatus[height] == 'confirming' && curHeight != 0 && height <= curHeight - 6)) {
            blockStatus[height] = 'check';
            $('#' + prefix + 'status').text('Checking');
            $('#' + prefix + 'status').addClass('blkheight-check');

            getBlockStatus(height, function (status) {
                if (status == 'error') {
                    blockStatus[height] = null;
                } else if (status == 'confirmed' && (curHeight == 0 || height > curHeight - 6)) {
                    blockStatus[height] = 'confirming';
                } else {
                    blockStatus[height] = status;
                }
                if (redrawMinedBlocksTimeout != null) {
                    clearTimeout(redrawMinedBlocksTimeout);
                }
                redrawMinedBlocksTimeout = setTimeout(redrawMinedBlocks, 500);
            });
        } else {
            if (blockStatus[height] == 'confirmed') {
                $('#' + prefix + 'status').text('Confirmed');
                $('#' + prefix + 'status').addClass('blkheight-confirmed');
            } else if (blockStatus[height] == 'confirming') {
                $('#' + prefix + 'status').text('Pending');
                $('#' + prefix + 'status').addClass('blkheight-pending');
            } else if (blockStatus[height] == 'orphaned') {
                $('#' + prefix + 'status').text('Orphaned');
                $('#' + prefix + 'status').addClass('blkheight-orphaned');
            }
        }
    });
};

var setCurrentBlock = function (height) {
    $('.currentblock').text(height);

    curHeight = height;
    redrawMinedBlocks();
};

var setBlockMinerInfo = function (height, miner) {
    blocks[height] = miner;
    redrawMinedBlocks();
};

var setGlobalHashrate = function (hashrate) {
    $('.globalhashrate').html(formatHashrate(hashrate));
};

var setPoolHashrate = function (hashrate, networkHashrate) {
    $('.poolhashrate').html(formatHashrate(hashrate));

    var percent = Math.floor(hashrate / networkHashrate * 1000) / 10;
    $('.poolhashratepercent').text('' + percent + '%');
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

                $('.poolluck').text('' + luckAverage + '%');

                drawLuckGraphs(luckInfo, luckAverage);
            }
        }
    });
};

var drawLuckGraphs = function (data, average) {
    var blocksVsHashrateSeries = [];
    var luckSeries = [];
    var colors = {
        primary: 'hsl(37, 100%, 55%)',
        secondary: 'hsl(5, 90%, 45%)',
        text: 'hsla(37, 100%, 85%, 0.87)',
        white: '#fff',
        border: 'hsla(37, 100%, 85%, 0.25)',
        borderLight: 'hsla(37, 100%, 85%, 0.125)'
    };

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
            lineColor: colors.border,
            lineWidth: 1,
            tickColor: colors.border,
            title: {
                text: 'Block heights',
                style: {
                    color: colors.text,
                    fontSize: '16px'
                }
            },
            labels: {
                style: {
                    color: colors.text,
                    fontSize: '14px'
                }
            }
        },
        yAxis: {
            lineColor: colors.border,
            lineWidth: 1,
            title: {
                text: 'Percentage',
                style: {
                    color: colors.text,
                    fontSize: '16px'
                }
            },
            min: 0,
            gridLineColor: colors.borderLight,
            labels: {
                style: {
                    color: colors.text,
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
                fontWeight: 'normal',
                color: colors.text

            },
            itemHoverStyle:{
                color: colors.white
            }
        },
        tooltip: {
            formatter: function() {
                return '<b>' + this.series.name + '</b><br>' + (this.x - 50) + '-' + (this.x + 50) + ':   <b>' + this.y + ' %</b>';
            }
        },
        chart: {
            zoomType: 'x',
            backgroundColor: 'transparent',
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
        colors: [colors.secondary , colors.primary],
        series: blocksVsHashrateSeries
    });

    $('#graph_luck').highcharts({
        title: {
            text: ''
        },
        xAxis: {
            lineColor: colors.border,
            lineWidth: 1,
            tickColor: colors.border,
            title: {
                text: 'Block heights',
                style: {
                    color: colors.text,
                    fontSize: '16px'
                }
            },
            labels: {
                style: {
                    color: colors.text,
                    fontSize: '14px'
                }
            }
        },
        yAxis: {
            lineColor: colors.border,
            lineWidth: 1,
            title: {
                text: 'Percentage',
                style: {
                    color: colors.text,
                    fontSize: '16px'
                }
            },
            min: 0,
            gridLineColor: colors.borderLight,
            labels: {
                style: {
                    color: colors.text,
                    fontSize: '14px'
                }
            },
            plotLines: [{
                value: average,
                color: colors.white,
                dashStyle: 'shortdash',
                width: 1,
                label: {
                    style: {
                        color: colors.text
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
                fontWeight: 'normal',
                color: colors.text
            },
            itemHoverStyle:{
                color: colors.white
            }
        },
        tooltip: {
            formatter: function() {
                return '<b>' + this.series.name + '</b><br/>' + (this.x - 50) + '-' + (this.x + 50) + ':   <b>' + this.y + ' %</b>';
            }
        },
        chart: {
            zoomType: 'x',
            backgroundColor: 'transparent',
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
        colors: [colors.white],
        series: luckSeries
    });
};

var activateElement = function (elementList, selector) {
    let match = selector;
    if (typeof selector === 'string') {
        match = (el) => el.matches(selector);
    }
    elementList.forEach(el => {
        el.classList.toggle('active', match(el));
    });
};

var initNavigation = function () {
    const contentElements = document.querySelectorAll('.contentdiv');
    const menuElements = document.querySelectorAll('nav li');

    function syncHash() {
        const hash = location.hash.substr(1) || 'poolnews';

        let elementToShow = '#content-' + hash;
        if (hash == 'stats') {
            getAndSetLuckInfo();
        }
        else if (hash == 'myworker') {
            _showWorker(myAddress);
        }
        else if (hash.match(/[GMWQmnw]\w{25,33}/)) {
            _showWorker(hash);
            elementToShow = '#content-myworker';
        }

        activateElement(contentElements, elementToShow);
        activateElement(menuElements, (el) => el.firstChild.hash === '#' + hash);

        const top = document.querySelector('.nav-flow').offsetTop + 32;
        if (window.scrollY > top) {
            window.scrollTo(0, top);
        }
    }

    syncHash();
    window.addEventListener('hashchange', syncHash);
};

var fixNavigation = function () {
    const nav = document.querySelector('nav');
    const fixAt = nav.offsetTop + nav.clientTop;

    const syncFixity = function () {
        nav.classList.toggle('fixed', window.scrollY >= fixAt);
    };

    syncFixity();
    window.addEventListener('scroll', syncFixity, { passive: true });
};

var highlightNewArticles = function () {
    document.querySelectorAll('#content-poolnews .date').forEach(el => {
        const dateString = el.getAttribute('datetime');
        const date = Date.parse(dateString);
        if (date) {
            const diff = Date.now() - date;
            const isNew = diff < 48 * 60 * 60 * 1000;
            el.classList.toggle('new', isNew);
        }
    });
};

var init = function () {
    initNavigation();
    fixNavigation();
    highlightNewArticles();

    document.querySelector('.discord a').addEventListener('click', function (e) {
        e.preventDefault();
        document.getElementsByClassName('overlay')[0].style.display = 'block';
    });

    document.addEventListener('click', function (e) {
        if (e.target.matches('.overlay')) {
            e.target.style.display="none";
        }
    });

    Highcharts.setOptions({
        lang: {
            numericSymbols: null
        },
        global: {
            useUTC: false
        }
    });

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

        // console.debug('Received event: ', type, data);

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

    getAndSetLuckInfo();
};

document.addEventListener('DOMContentLoaded', init);
