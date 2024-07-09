var scanlines = $('.scanlines');
var tv = $('.tv');
function exit() {
    $('.tv').addClass('collapse');
    term.disable();
}

// ref: https://stackoverflow.com/q/67322922/387194
var __EVAL = (s) => eval(`void (__EVAL = ${__EVAL}); ${s}`);

var term = $('#terminal').terminal(function(command, term) {
    var cmd = $.terminal.parse_command(command);
    if (cmd.name === 'exit') {
        exit();
    } else if (cmd.name === 'echo') {
        term.echo(cmd.rest);
    } else if (command !== '') {
        try {
            var result = __EVAL(command);
            if (result && result instanceof $.fn.init) {
                term.echo('<#jQuery>');
            } else if (result && typeof result === 'object') {
                tree(result);
            } else if (result !== undefined) {
                term.echo(new String(result));
            }
        } catch(e) {
            term.error(new String(e));
        }
    }
}, {
    name: 'js_demo',
    onResize: set_size,
    exit: false,
    // detect iframe codepen preview
    enabled: $('body').attr('onload') === undefined,
    onInit: function() {
        set_size();
        fetch('schedule.csv')
            .then(response => response.text())
            .then(data => {
                const schedule = parseCSV(data);
                const performances = getPerformances(schedule);
                term.echo(' ');
                term.echo(`     [[b;#fff;]Now:] ${stripColon(performances.now)}`);
                term.echo(`          ${performances.now_info} `);
                term.echo(' ');
                term.echo(' ');
                term.echo(`    [[b;#fff;]Next:] ${stripColon(performances.next)}`);
                term.echo(`          ${performances.next_info} `);
                term.echo(' ');
                term.echo(' ');
                term.echo('   [[b;#fff;]Later:] ' + performances.later.map(stripColon).join('\n          '));
                term.echo(' ');
                term.echo(' ');
            })
            .catch(error => console.error('Error fetching the CSV file:', error));
    },
    onClear: function() {
        console.log(this.find('video').length);
        this.find('video').map(function() {
            console.log(this.src);
            return this.src;
        });
    },
    prompt: '$ > '
});

// for codepen preview
if (!term.enabled()) {
    term.find('.cursor').addClass('blink');
}
function set_size() {
    // for window height of 170 it should be 2s
    var height = $(window).height();
    var width = $(window).width()
    var time = (height * 2) / 170;
    scanlines[0].style.setProperty("--time", time);
    tv[0].style.setProperty("--width", width);
    tv[0].style.setProperty("--height", height);
}

function tree(obj) {
    term.echo(treeify.asTree(obj, true, true));
}

var constraints = {
    audio: false,
    video: {
        width: { ideal: 1280 },
        height: { ideal: 1024 },
        facingMode: "environment"
    }
};
var acceptStream = (function() {
    return 'srcObject' in document.createElement('video');
})();
function camera() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        term.pause();
        var media = navigator.mediaDevices.getUserMedia(constraints);
        media.then(function(mediaStream) {
            term.resume();
            var stream;
            if (!acceptStream) {
                stream = window.URL.createObjectURL(mediaStream);
            } else {
                stream = mediaStream;
            }
            term.echo('<video data-play="true" class="self"></video>', {
                raw: true,
                onClear: function() {
                    if (!acceptStream) {
                        URL.revokeObjectURL(stream);
                    }
                    mediaStream.getTracks().forEach(track => track.stop());
                },
                finalize: function(div) {
                    var video = div.find('video');
                    if (!video.length) {
                        return;
                    }
                    if (acceptStream) {
                        video[0].srcObject = stream;
                    } else {
                        video[0].src = stream;
                    }
                    if (video.data('play')) {
                        video[0].play();
                    }
                }
            });
        });
    }
}
var play = function() {
    var video = term.find('video').slice(-1);
    if (video.length) {
        video[0].play();
    }
}
function pause() {
    term.find('video').each(function() {
        this.pause(); 
    });
}

function grab() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        term.pause();
        var media = navigator.mediaDevices.getUserMedia(constraints);
        media.then(function(mediaStream) {
            const mediaStreamTrack = mediaStream.getVideoTracks()[0];
            const imageCapture = new ImageCapture(mediaStreamTrack);
            return imageCapture.takePhoto();
        }).then(function(blob) {
            term.echo('<img src="' + URL.createObjectURL(blob) + '" class="self"/>', {
                raw: true,
                finialize: function(div) {
                    div.find('img').on('load', function() {
                        URL.revokeObjectURL(this.src);
                    });
                }
            }).resume();
        }).catch(function(error) {
            term.error('Device Media Error: ' + error);
        });
    }
}
async function pictuteInPicture() {
    var [video] = $('video');
    try {
        if (video) {
            if (video !== document.pictureInPictureElement) {
                await video.requestPictureInPicture();
            } else {
                await document.exitPictureInPicture();
            }
        }
  } catch(error) {
      term.error(error);
  }
}
function clear() {
    term.clear();
}

// New functions for schedule processing

// Function to parse CSV data
// Function to parse CSV data
function parseCSV(data) {
    const lines = data.split('\n');
    const result = [];
    const regex = /(?:,|^)("(?:[^"]|"")*"|[^",]*)/g;

    for (let i = 0; i < lines.length; i++) {
        let match;
        let row = [];

        // Use regex to split CSV values, considering quoted fields
        while ((match = regex.exec(lines[i]))) {
            let value = match[1];

            // Remove quotes and handle double quotes
            if (value.charAt(0) === '"') {
                value = value.slice(1, -1).replace(/""/g, '"');
            }

            row.push(value.trim());
        }

        if (row.length === 5) {
            result.push({
                artist: row[0],
                day: row[1],
                start: row[2],
                end: row[3],
                info: row[4]
            });
        }
    }
    return result;
}


// Function to get the current 'stage-day' as a three-letter abbreviation
function getDayAbbreviation() {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const date = new Date();
    const currentHour = date.getHours();
    
    // If the current hour is between midnight (00:00) and 4am (04:00),
    // return the abbreviation of the previous day
    if (currentHour >= 0 && currentHour < 4) {
        const prevDayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
        return days[prevDayIndex];
    } else {
        return days[date.getDay()];
    }
}

// Function to get the current time in HH:MM format
function getCurrentTime() {
    const date = new Date();
    let hours = date.getHours();
    let minutes = date.getMinutes();
    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes}`;
}

// Function to strip colon from HH:MM format to HHMM
function stripColon(timeStr) {
    return timeStr.replace(':', '');
}

// Function to find the current, next, and later performances
function getPerformances(schedule) {
    const currentDay = getDayAbbreviation();
    const currentTime = getCurrentTime();
    let performances = [];

    // Find all performances within the 'stage-day'
    for (let i = 0; i < schedule.length; i++) {
        const performance = schedule[i];
        if (performance.day === currentDay) {
            performances.push({
                artist: performance.artist,
                start: performance.start,
                end: performance.end,
                info: performance.info
            });
        }
    }

    console.log('Performances within the stage-day:', performances);

    // Now process the performances to find the current, next, and later performances
    let now = 'FIN';
    let next = 'FIN';
    let now_info = '';
    let next_info = '';
    let later = [];

    for (let i = 0; i < performances.length; i++) {
        const performance = performances[i];

        // Handle the case where end time is on the next day
        let endTime = performance.end;
        if (performance.end < performance.start) {
            endTime = '24:00';
        }

        // Check if the current time is within the performance timeframe
        if (performance.start <= currentTime && endTime > currentTime) {
            now = performance.artist === 'FIN' ? 'FIN' : `${performance.artist} (${stripColon(performance.start)}-${stripColon(performance.end)})`;
            now_info = performance.info;

            // Find the next performance
            if (i < performances.length - 1) {
                const nextPerformance = performances[i + 1];
                next = nextPerformance.artist === 'FIN' ? 'FIN' : `${nextPerformance.artist} (${stripColon(nextPerformance.start)}-${stripColon(nextPerformance.end)})`;
                next_info = nextPerformance.info;
            } else {
                next = 'FIN'; // No next performance found, default to 'FIN'
            }

            // Find later performances (limit to 4 entries)
            for (let j = i + 2; j < performances.length; j++) {
                if (later.length < 6) {
                    const laterPerformance = performances[j];
                    later.push(laterPerformance.artist === 'FIN' ? 'FIN' : `${laterPerformance.artist} (${stripColon(laterPerformance.start)}-${stripColon(laterPerformance.end)})`);
                } else {
                    break; // Limit of 4 entries reached
                }
            }

            break; // Found the current performance, exit the loop
        }
    }

    // Format later performances for display
    later = later.length > 0 ? later : ['FIN'];

    return { now, next, later, now_info, next_info};
}







cssVars(); // ponyfill