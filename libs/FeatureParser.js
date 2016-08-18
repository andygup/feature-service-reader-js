/**
 * Created by andy4683 on 7/13/16.
 */
/**
 * @author Andy Gup
 *
 * This class manages a ThreadPool for breaking up larger JSON files
 * the processing each piece on its own thread and then reconstituting
 * the results.
 *
 * This class is specifically designed for the following use cases
 * - Processing JSON files
 * - The files are updated on an interval - no less than 5 minutes apart
 * - The files are fairly similar in size - not too much variance
 */
define([
    "dojo/_base/declare",
    "dojo/_base/Deferred",
    "dojo/promise/all"
], function(declare, Deferred, all) {

    return declare("A.esri.FeatureParser",[], {
        _numberOfThreads: 2,

        workerUrl: "libs/FeatureWorker.js",
        worker: [],

        constructor: function(threadCount){
            this._numberOfThreads = threadCount || this._numberOfThreads;
        },

        init: function(feature){

            var dfd = new Deferred();

            console.time("total parse time");

            var chunkArray = this.chunk(feature.features.length);

            this.slice(chunkArray,feature.features)
                .then(function(result){
                    console.timeEnd("total parse time");
                    console.time("time to concatenate");
                    dfd.resolve(this.concat(result));
                }.bind(this));

            return dfd.promise;
        },

        /**
         * Creates an array of break points for dividing up the JSON in semi-equal tasks across workers.
         * @return {Array}
         */
        chunk: function(featureLength){
            var chunk = Math.ceil( featureLength / this._numberOfThreads), breaks = [0];

            // 1st attempt at creating breaking points
            for(var i = chunk; i <= featureLength; i += chunk){
                breaks.push(i);
            }

            // If we have a remainder value let's add it back to the breaks array
            if(breaks[breaks.length - 1] < featureLength){
                breaks.push(featureLength);
            }

            return breaks;
        },

        /**
         * Break up the array into smaller pieces that can each be assigned to a worker thread
         * @param chunkArray
         * @param feature
         */
        slice: function(chunkArray, feature){
            var subFeature;
            var promises = [];

            // Handle a single thread
            if(chunkArray.length == 1) {
                promises[0] = this.create(0, feature);
            }
            else if(chunkArray.length > 1) {
                for(var i = 1; i < chunkArray.length; i++){
                    // Grab the features associated with this chunk
                    subFeature = feature.slice(chunkArray[i - 1], chunkArray[i]);

                    // Spawn worker threads for each chunk of subfeatures
                    promises[i - 1] = this.create(i - 1, subFeature);
                }
            }

            return all(promises);
        },

        /**
         * Concatenate all the separate arrays back together.
         * In theory, each object returned will have the same object fields.
         * @param array
         * @return {Array}
         */
        concat: function(array){

            var baseObject = {};

            var objectOne = array[0].result.data.features;
            var objectTwo = array[1].result.data.features;

            for (var key in objectOne) {
                if (objectOne.hasOwnProperty(key)) {

                    if (JSON.stringify(objectOne[key] !== JSON.stringify(objectTwo[key]))) {
                        baseObject[key] = objectOne[key];
                    }

                    else {

                        baseObject[key].max = Math.max(objectOne[key].max, objectTwo[key].max);
                        baseObject[key].min = Math.min(objectOne[key].min, objectTwo[key].min);
                    }
                }
                else {
                    console.log("FeatureParser.concat() - invalid key: " + key);
                }
            }

            console.timeEnd("time to concatenate");

            return baseObject;
        },

        /**
         * Create workers
         * @param count
         * @param feature
         * @return {deferred}
         */
        create: function(count, feature){
            var dfd = new Deferred();

            console.time("complete process on thread time");

            this.worker[count] = new Worker(this.workerUrl);

            // Send the feature to the background thread
            this.worker[count].postMessage(
                {
                    features: feature
                }
            );

            // Get back the processed Esri JSON on the main thread
            this.worker[count].onmessage = function(result){
                dfd.resolve({result:result,error:null});
                console.timeEnd("complete process on thread time");
            };

            this.worker[count].onerror = function(err){
                console.log("Worker error: " + err.message);
                dfd.resolve({result:null,error:err.message});
            };

            return dfd;
        },

        destroy: function(){
            for(var i = 0; i < this.worker.length; i++){
                this.worker[i].terminate();
            }
        }
    })
});