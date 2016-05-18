/**
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

goog.module('historian.powerEstimatorTest');
goog.setTestOnly('historian.powerEstimatorTest');

var Estimator = goog.require('historian.power.Estimator');
var testSuite = goog.require('goog.testing.testSuite');


/**
 * Creates a running event with a single wakeup value.
 * @param {number} startTime
 * @param {number} endTime
 * @param {string} value Wakeup reason.
 * @return {!historian.AggregatedEntry}
 */
var createRunningEvent = function(startTime, endTime, value) {
  return {
    startTime: startTime,
    endTime: endTime,
    services: [
      {
        startTime: startTime,
        endTime: endTime,
        value: value
      }
    ]
  };
};


/**
 * Creates a powermonitor power event.
 * @param {number} startTime
 * @param {number} endTime
 * @param {number} value Power reading in mAh.
 * @return {!historian.Entry}
 */
var createPowermonitorEvent = function(startTime, endTime, value) {
  return {
    startTime: startTime,
    endTime: endTime,
    value: value
  };
};

testSuite({
  /**
   * Tests the creating of wake up reasons to power events mappings.
   */
  testMatchPowermonitorEvents: function() {
    var tests = [
      {
        desc: 'Filtering of running events for those in powermonitor events' +
            'range',
        runningEvents: [
          // Out of powermonitor events range.
          createRunningEvent(0, 350, 'r1'),
          createRunningEvent(500, 700, 'r1'),
          createRunningEvent(1000, 1200, 'r1'),
          createRunningEvent(1499, 1500, 'r1'),
          // Out of powermonitor events range.
          createRunningEvent(1500, 1600, 'r1')
        ],
        powermonitorEvents: [
          createPowermonitorEvent(600, 700, 10),
          createPowermonitorEvent(700, 800, 10),
          createPowermonitorEvent(800, 900, 20),
          createPowermonitorEvent(900, 1000, 20),
          createPowermonitorEvent(1000, 1100, 10),
          createPowermonitorEvent(1100, 1200, 10),
          createPowermonitorEvent(1100, 1200, 10),
          createPowermonitorEvent(1200, 1300, 10),
          createPowermonitorEvent(1300, 1400, 20),
          createPowermonitorEvent(1400, 1500, 10),
        ],
        expectedTimeRanges: {
          'r1': [
            {start: 600, end: 700},
            {start: 1000, end: 1200},
            {start: 1400, end: 1500}
          ]
        },
      },
      {
        desc: 'Running event borders on powermonitor event',
        runningEvents: [
          createRunningEvent(50, 250, 'r1')
        ],
        powermonitorEvents: [
          {
            startTime: 0,
            endTime: 50,
            value: 1000
          }
        ],
        expectedTimeRanges: {},
        expectedPower: []
      },
      {
        desc: 'First running event does not overlap with any powermonitor' +
            ' event',
        runningEvents: [
          createRunningEvent(50, 250, 'r1'),
          createRunningEvent(500, 700, 'r2')
        ],
        powermonitorEvents: [
          createPowermonitorEvent(0, 30, 1000),
          createPowermonitorEvent(400, 900, 7200)
        ],
        expectedTimeRanges: {
          'r1': [null],
          'r2': [
            {start: 400, end: 900}
          ]
        },
        expectedPower: [
          {name: 'r2', power: 1},
          {name: 'r1', power: 0}
        ]
      },
      {
        desc: 'Running events overlap same powermonitor event',
        runningEvents: [
          createRunningEvent(0, 1500, 'r1'),
          createRunningEvent(1750, 2500, 'r2')
        ],
        powermonitorEvents: [
          createPowermonitorEvent(1000, 2000, 7200)
        ],
        expectedTimeRanges: {
          'r1': [
            {start: 1000, end: 2000}
          ],
          'r2': [
            {start: 1000, end: 2000}
          ]
        },
        expectedPower: [
          {name: 'r1', power: 2},
          {name: 'r2', power: 2}
        ]
      },
      {
        desc: 'Multiple running events of same type, shares same powermonitor' +
            ' event',
        runningEvents: [
          createRunningEvent(1750, 2500, 'r1'),
          createRunningEvent(2500, 4000, 'r1')
        ],
        powermonitorEvents: [
          createPowermonitorEvent(1000, 2000, 7200),
          createPowermonitorEvent(2000, 3000, 7200),
          createPowermonitorEvent(3000, 4000, 7200)
        ],
        expectedTimeRanges: {
          'r1': [
            {start: 1000, end: 3000},
            {start: 2000, end: 4000}
          ],
        },
        expectedPower: [
          {name: 'r1', power: 6}
        ]
      },
      {
        desc: 'One running event corresponding to two powermonitor events',
        runningEvents: [
          createRunningEvent(500, 2500, 'r1')
        ],
        powermonitorEvents: [
          createPowermonitorEvent(0, 1000, 3600),
          createPowermonitorEvent(1000, 1500, 7200)
        ],
        expectedTimeRanges: {
          'r1': [
            {start: 0, end: 1500}
          ]
        },
        expectedPower: [
          {name: 'r1', power: 2}
        ]
      },
      {
        desc: 'Abort wakeup reasons',
        runningEvents: [
          {
            startTime: 500,
            endTime: 2000,
            services: [
              {
                startTime: 500,
                endTime: 1000,
                value: 'Abort: Last active wakeup source'
              },
              {
                startTime: 500,
                endTime: 2000,
                value: 'r1'
              }
            ]
          }
        ],
        powermonitorEvents: [
          createPowermonitorEvent(1000, 2000, 7200)
        ],
        expectedTimeRanges: {
          'r1': [
            {start: 1000, end: 2000}
          ]
        },
        expectedPower: [
          {name: 'r1', power: 2}
        ]
      },
      {
        desc: 'Running event only has abort wakeup reasons',
        runningEvents: [
          {
            startTime: 500,
            endTime: 2000,
            services: [
              {
                startTime: 500,
                endTime: 1000,
                value: 'Abort: Last active wakeup source'
              },
              {
                startTime: 1000,
                endTime: 2000,
                value: 'Abort: Pending wakeup sources'
              }
            ]
          }
        ],
        powermonitorEvents: [
          createPowermonitorEvent(1000, 2000, 7200)
        ],
        expectedTimeRanges: {
          'No non abort events found': [
            {start: 1000, end: 2000}
          ]
        },
        expectedPower: [
          {name: 'No non abort events found', power: 2}
        ]
      },
      {
        desc: 'No intersecting powermonitor events, no non abort wakeup' +
            ' reasons',
        runningEvents: [
          {
            startTime: 500,
            endTime: 2000,
            services: [
              {
                startTime: 500,
                endTime: 1000,
                value: 'Abort: Last active wakeup source'
              },
              {
                startTime: 1000,
                endTime: 2000,
                value: 'Abort: Pending wakeup sources'
              }
            ]
          }
        ],
        powermonitorEvents: [
          createPowermonitorEvent(0, 400, 7200),
          createPowermonitorEvent(2000, 3000, 1200),
          createPowermonitorEvent(3000, 4000, 3600)
        ],
        expectedTimeRanges: {
          'No non abort events found': [null]
        },
        expectedPower: [
          {name: 'No non abort events found', power: 0}
        ]
      },
      {
        desc: 'Increasing edge before wakeup event',
        runningEvents: [
          {
            startTime: 800,
            endTime: 1000,
            services: [
              {
                startTime: 800,
                endTime: 1000,
                value: 'wr'
              }
            ]
          }
        ],
        powermonitorEvents: [
          createPowermonitorEvent(0, 100, 10),
          createPowermonitorEvent(100, 200, 60),
          createPowermonitorEvent(200, 300, 80),
          // Start of increasing edge.
          createPowermonitorEvent(300, 400, 20),
          createPowermonitorEvent(400, 500, 70),
          // Decreased, but still above base threshold.
          createPowermonitorEvent(500, 600, 60),
          createPowermonitorEvent(600, 700, 200),
          createPowermonitorEvent(700, 800, 500),
          createPowermonitorEvent(900, 1000, 700)
        ],
        expectedTimeRanges: {
          'wr': [{start: 300, end: 1000}]
        }
      },
      {
        desc: 'Increasing edge start index equal to wakeup event start time',
        runningEvents: [
          {
            startTime: 800,
            endTime: 1000,
            services: [
              {
                startTime: 800,
                endTime: 1000,
                value: 'wr'
              }
            ]
          }
        ],
        powermonitorEvents: [
          createPowermonitorEvent(500, 600, 0),
          createPowermonitorEvent(600, 700, 30),
          createPowermonitorEvent(700, 800, 40),
          // Start of increasing edge.
          createPowermonitorEvent(800, 900, 0),
          createPowermonitorEvent(900, 1000, 70)
        ],
        expectedTimeRanges: {
          'wr': [{start: 800, end: 1000}]
        }
      },
      {
        desc: 'Decreasing edge after wakeup event',
        runningEvents: [
          {
            startTime: 500,
            endTime: 1000,
            services: [
              {
                startTime: 500,
                endTime: 1000,
                value: 'wr'
              }
            ]
          }
        ],
        powermonitorEvents: [
          createPowermonitorEvent(900, 1000, 300),
          createPowermonitorEvent(1000, 1100, 200),
          createPowermonitorEvent(1100, 1200, 100),
          // Increasing but above base threshold.
          createPowermonitorEvent(1200, 1300, 200),
          createPowermonitorEvent(1300, 1400, 100),
          // Reached base threshold.
          createPowermonitorEvent(1400, 1500, 50),
          createPowermonitorEvent(1500, 1600, 30),
          createPowermonitorEvent(1600, 1700, 10),
          // Larger than previous entry, not included.
          createPowermonitorEvent(1700, 1800, 20)
        ],
        expectedTimeRanges: {
          'wr': [{start: 900, end: 1700}]
        }
      },
      {
        desc: 'Decreasing edge after wakeup event intersects with next wakeup',
        runningEvents: [
          {
            startTime: 1500,
            endTime: 2000,
            services: [
              {
                startTime: 1500,
                endTime: 2000,
                value: 'wr1'
              }
            ]
          },
          {
            startTime: 2200,
            endTime: 3000,
            services: [
              {
                startTime: 2200,
                endTime: 3000,
                value: 'wr2'
              }
            ]
          }
        ],
        powermonitorEvents: [
          createPowermonitorEvent(1800, 1900, 7200),
          // End of first wakeup reason intersection.
          createPowermonitorEvent(1900, 2000, 1200),
          createPowermonitorEvent(2000, 2100, 300),
          createPowermonitorEvent(2100, 2200, 40),
          // Intersects with next wakeup.
          createPowermonitorEvent(2200, 2300, 20),
          createPowermonitorEvent(2300, 2400, 100)
        ],
        expectedTimeRanges: {
          'wr1': [{start: 1800, end: 2200}],
          'wr2': [{start: 2200, end: 2400}]
        }
      },
      {
        desc: 'High values after wakeup event intersects with next wakeup',
        runningEvents: [
          {
            startTime: 1500,
            endTime: 2000,
            services: [
              {
                startTime: 1500,
                endTime: 2000,
                value: 'wr1'
              }
            ]
          },
          {
            startTime: 2200,
            endTime: 3000,
            services: [
              {
                startTime: 2200,
                endTime: 3000,
                value: 'wr2'
              }
            ]
          }
        ],
        powermonitorEvents: [
          createPowermonitorEvent(1800, 1900, 7200),
          // End of first wakeup reason intersection.
          createPowermonitorEvent(1900, 2000, 1200),
          createPowermonitorEvent(2000, 2100, 300),
          createPowermonitorEvent(2100, 2200, 700),
          // Intersects with next wakeup.
          createPowermonitorEvent(2200, 2300, 800),
          createPowermonitorEvent(2300, 2400, 1000)
        ],
        expectedTimeRanges: {
          'wr1': [{start: 1800, end: 2200}],
          'wr2': [{start: 2100, end: 2400}]
        }
      }
    ];

    tests.forEach(function(test) {
      var powerEstimator =
          new Estimator(test.runningEvents, test.powermonitorEvents, null);

      if (test.expectedPower) {
        assertArrayEquals(
            test.desc, test.expectedPower, powerEstimator.getWakeupReasons());
      }

      for (var wakeupReason in test.expectedTimeRanges) {
        var expectedTimes = test.expectedTimeRanges[wakeupReason];
        var gotEvents = powerEstimator.getEvents(wakeupReason);
        var gotTimes = [];
        gotEvents.forEach(function(event) {
          gotTimes.push(event.getTimeRange());
        });
        assertObjectEquals(test.desc, expectedTimes, gotTimes);
      }
    });
  },
  /**
   * Tests the generation of per wakeup stats tables.
   */
  testGeneratePerWakeupTables: function() {
    var tests = [
      {
        desc: 'No overlapping powermonitor events',
        runningEvents: [
          createRunningEvent(50, 250, 'r1')
        ],
        powermonitorEvents: [
          createPowermonitorEvent(0, 50, 100),
          createPowermonitorEvent(250, 300, 100)
        ],
        expectedPerWakeupTables: {
          'Duration': [
            ['r1', '0ms', '0ms', '0ms', '0ms', '0ms']
          ],
          'Current (mA)': [
            ['r1', '0.000', '0.000', '0.000', '0.000']
          ],
          'Energy (mAh)': [
            ['r1', '0.000', '0.000', '0.000', '0.000', '0.000']
          ]
        }
      },
      {
        desc: 'Multiple wakeup types',
        runningEvents: [
          createRunningEvent(0, 100, 'r2'),
          createRunningEvent(350, 500, 'r3'),
          createRunningEvent(600, 750, 'r2'),
          createRunningEvent(1000, 1100, 'r2'),
          createRunningEvent(1400, 1500, 'r3'),
          createRunningEvent(1700, 31500, 'r1')
        ],
        powermonitorEvents: [
          createPowermonitorEvent(0, 100, 170), // r2
          createPowermonitorEvent(100, 200, 30), // r2
          createPowermonitorEvent(200, 300, 40), // none
          createPowermonitorEvent(300, 400, 10), // r3
          createPowermonitorEvent(400, 500, 7160), // r3
          createPowermonitorEvent(500, 600, 30), // r3
          createPowermonitorEvent(600, 700, 20), // r2
          createPowermonitorEvent(700, 800, 100), // r2
          createPowermonitorEvent(800, 900, 30), // r2
          createPowermonitorEvent(900, 1000, 100), // none
          createPowermonitorEvent(1000, 1100, 30), // r2
          createPowermonitorEvent(1100, 1200, 40), // none
          createPowermonitorEvent(1200, 1300, 30), // r3
          createPowermonitorEvent(1300, 1400, 7270), // r3
          createPowermonitorEvent(1400, 1500, 7070), // r3
          createPowermonitorEvent(1500, 1600, 30), // r3
          createPowermonitorEvent(1600, 1700, 40), // none
          createPowermonitorEvent(1700, 1800, 10) // r1
        ],
        expectedPerWakeupTables: {
          'Duration': [
            ['r3', '350ms', '400ms', '300ms', '400ms', '700ms'],
            ['r2', '200ms', '200ms', '100ms', '300ms', '600ms'],
            ['r1', '100ms', '100ms', '100ms', '100ms', '100ms']
          ],
          'Current (mA)': [
            ['r3', '3000.000', '3600.000', '2400.000', '3600.000'],
            ['r2', '60.000', '50.000', '30.000', '100.000'],
            ['r1', '10.000', '10.000', '10.000', '10.000']
          ],
          'Energy (mAh)': [
            ['r3', '0.300', '0.400', '0.200', '0.400', '0.600'],
            ['r2', '0.004', '0.004', '0.001', '0.006', '0.011'],
            ['r1', '0.000', '0.000', '0.000', '0.000', '0.000']
          ]
        }
      }
    ];
    tests.forEach(function(test) {
      var powerEstimator =
          new Estimator(test.runningEvents, test.powermonitorEvents, null);
      var gotTables = powerEstimator.generateWakeupTables();
      assertObjectEquals(test.desc, test.expectedPerWakeupTables, gotTables);
    });
  },
  /**
   * Tests the generation of summary stats.
   */
  testGenerateSummaryStats: function() {
    var tests = [
      {
        desc: 'No wakeups',
        runningEvents: [],
        powermonitorEvents: [
          createPowermonitorEvent(0, 100, 100),
          createPowermonitorEvent(100, 200, 200),
          createPowermonitorEvent(200, 300, 200),
          createPowermonitorEvent(300, 400, 100),
          createPowermonitorEvent(400, 500, 200)
        ],
        expectedSummary: {
          suspendTime: '500ms',
          wakeupTime: '0ms',
          suspendEnergy: '0.022 mAh',
          wakeupEnergy: '0.000 mAh',
          avgWakeupCurrent: '0.000 mA',
          avgSuspendCurrent: '160.000 mA'
        }
      },
      {
        desc: 'Multiple wakeup types',
        runningEvents: [
          createRunningEvent(130, 180, 'r1'),
          createRunningEvent(300, 500, 'r2'),
          createRunningEvent(910, 1200, 'r1'),
        ],
        powermonitorEvents: [
          createPowermonitorEvent(0, 100, 100), // r1
          createPowermonitorEvent(100, 200, 7060), // r1
          createPowermonitorEvent(200, 300, 40), // r1
          createPowermonitorEvent(300, 400, 30), //r2
          createPowermonitorEvent(400, 500, 3530), // r2
          createPowermonitorEvent(500, 600, 40), // r2
          createPowermonitorEvent(600, 700, 3550), // none
          createPowermonitorEvent(700, 800, 50), // none
          createPowermonitorEvent(800, 900, 40), // r1
          createPowermonitorEvent(900, 1000, 7160) // r1
        ],
        expectedSummary: {
          suspendTime: '200ms',
          wakeupTime: '800ms',
          suspendEnergy: '0.100 mAh',
          wakeupEnergy: '0.500 mAh',
          avgWakeupCurrent: '2250.000 mA',
          avgSuspendCurrent: '1800.000 mA'
        }
      }
    ];
    tests.forEach(function(test) {
      var powerEstimator =
          new Estimator(test.runningEvents, test.powermonitorEvents, null);
      var gotSummary = powerEstimator.generateSummaryStats();
      assertObjectEquals(test.desc, test.expectedSummary, gotSummary);
    });
  },
  /**
   * Tests getting the power event associated with a running event.
   */
  testGetRunningPowerEvent: function() {
    var runningEvents = [
      createRunningEvent(0, 100, 'r2'),
      createRunningEvent(350, 500, 'r3'),
      createRunningEvent(600, 750, 'r2'),
      createRunningEvent(1000, 1100, 'r2')
    ];
    var powermonitorEvents = [
      createPowermonitorEvent(0, 100, 170), // r2
      createPowermonitorEvent(100, 200, 30), // r2
      createPowermonitorEvent(200, 300, 40), // none
      createPowermonitorEvent(300, 400, 10), // r3
      createPowermonitorEvent(400, 500, 7160), // r3
      createPowermonitorEvent(500, 600, 30), // r3
      createPowermonitorEvent(600, 700, 20), // r2
      createPowermonitorEvent(700, 800, 100), // r2
      createPowermonitorEvent(800, 900, 30), // r2
      createPowermonitorEvent(900, 1000, 100), // none
      createPowermonitorEvent(1000, 1100, 30), // r2
      createPowermonitorEvent(1100, 1200, 40), // none
    ];
    var expectedPowerEventTimes = [
      {start: 0, end: 200},
      {start: 300, end: 600},
      {start: 600, end: 900},
      {start: 1000, end: 1100}
    ];

    var powerEstimator = new Estimator(runningEvents, powermonitorEvents);
    runningEvents.forEach(function(event, i) {
      var got = powerEstimator.getRunningPowerEvent(event);
      assertObjectEquals('existing running events',
          expectedPowerEventTimes[i], got.getTimeRange());
    });
    var notPresent = createRunningEvent(1200, 1300, 'r2');
    assertNull('non existent running event',
        powerEstimator.getRunningPowerEvent(notPresent));
  }
});
