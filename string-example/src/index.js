exports.handler = async (event, context, callback) => {
    console.log("### Context is : " + JSON.stringify(context));
    console.log("### Event is: " + JSON.stringify(event));

    try {
        let inputString = event.inputString || "";
        let response = {
            characterCount: inputString.length
        };

        console.log("Function completed: Returning: " + JSON.stringify(response));
        return response;
    } catch (error) {
        console.error("Handler failed: " + error);
        callback(error);
    }
};
