/**
 * BlacklightAlma is a Javascript class for integration with Alma.
 * AJAX calls are made to endpoints on the Rails server that
 * in turn communicate with Alma.
 */

var BlacklightAlma = function (options) {
    options = options || {};
    this.MAX_AJAX_ATTEMPTS = options.maxAjaxAttempts || 3;
};

/**
 * Subclasses should override to customize.
 * @param holding
 * @returns {string}
 */
 availabilityInfo = function (holding) {
   var libraryAndLocation = [holding['library'], holding['location']].join(" - ");
   var capitalAvail = holding['availability'].charAt(0).toUpperCase() + holding['availability'].slice(1);
   if(holding['availability'] === 'available') {
     return [capitalAvail, 'at', libraryAndLocation, holding['call_number']]
         .filter(function (item) {
             return item != null && item.length > 0;
         }).join(" ");
   }
   else if(holding['availability'] === 'unavailable') {
     return "Checked out or temporarily unavailable"
   } else {
     return [holding['availability'], libraryAndLocation, holding['call_number']]
         .filter(function (item) {
             return item != null && item.length > 0;
         }).join(" ");
   }
 }

 BlacklightAlma.prototype.formatHolding = function (mms_id, holding) {
     if(holding['inventory_type'] == 'physical') {
       return availabilityInfo(holding);
     }
     else if(holding['inventory_type'] == 'digital') {
         var joined = [holding['institution'], holding['repository_name'], holding['label'], holding['representation']]
             .filter(function (item) {
                 return item != null && item.length > 0;
             }).join(" - ");
         return joined || "Digital Resource (no other information available)";
     }
     else if(holding['inventory_type'] == 'electronic') {
         var url = null;
         if(holding['link_to_service_page']) {
             var text = holding['collection'] || "Electronic resource";
             url = '<a href="' + holding['link_to_service_page'] + '">' + text + '</a>';
         }
         url = url || "Electronic Resource (no URL available)";
         return [url, holding['coverage_statement']]
             .filter(function (item) {
                 return item != null && item.length > 0;
             }).join(" - ");
     }
 };

/**
 * Subclasses should override to customize.
 * @param holding
 * @returns {string}
 */
BlacklightAlma.prototype.formatHoldings = function (holdings) {
    return holdings.join("<br/>");
};

/**
 * Populates html document with availability status strings
 * @param data
 */
BlacklightAlma.prototype.populateAvailability = function (data) {
    var baObj = this;
    var availability = data['availability'];
    $(".availability-ajax-load").each(function (index, element) {
        var id = $(element).data("availabilityId");
        if (availability[id]) {
            var holdings = availability[id]['holdings'] || [];
            var holdingsList = baObj.formatHoldings($.map(holdings, baObj.formatHolding));
            if (holdingsList.length > 0) {
                $(element).html(holdingsList);
                return;
            }
        }
        $(element).html("<span style='color: red'>No status available for this item</span>");
    });
};

/**
 * Subclasses should override to customize.
 */
BlacklightAlma.prototype.errorLoadingAvailability = function () {
    $(".availability-ajax-load").html("<span style='color: red'>Error loading status for this item</span>");
};

/**
 * Actually makes the AJAX call for availability
 * @param idList
 * @param attemptCount
 */
BlacklightAlma.prototype.loadAvailabilityAjax = function (idList, attemptCount) {
    var baObj = this;
    if(idList.length > 0) {
        var url = "/alma/availability.json?id_list=" + encodeURIComponent(idList);
        console.log(url);
        $.ajax(url, {
            timeout: 5000,
            success: function(data, textStatus, jqXHR) {
                if(!data.error) {
                    console.log(data);
                    baObj.populateAvailability(data);
                } else {
                    console.log("Attempt #" + attemptCount + " error loading availability: " + data.error);
                    // errors here aren't necessary "fatal", they could be temporary
                    if(attemptCount < baObj.MAX_AJAX_ATTEMPTS) {
                        baObj.loadAvailabilityAjax(idList, attemptCount + 1);
                    } else {
                        baObj.errorLoadingAvailability();
                    }
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.log("Attempt #" + attemptCount + " error loading availability: " + textStatus + ", " + errorThrown);
                if(attemptCount < baObj.MAX_AJAX_ATTEMPTS) {
                    baObj.loadAvailabilityAjax(idList, attemptCount + 1);
                } else {
                    baObj.errorLoadingAvailability();
                }
            }
        });
    }
};

/**
 * Looks for elements with class availability-ajax-load,
 * batches up the values in their data-availability-id attribute,
 * makes the AJAX request, and replaces the contents
 * of the element with availability information.
 */
BlacklightAlma.prototype.loadAvailability = function() {
    var idList = $(".availability-ajax-load").map(function (index, element) {
        return $(element).data("availabilityId");
    }).get().join(",");

    this.loadAvailabilityAjax(idList, 1);
};
