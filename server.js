const AWS = require('aws-sdk');

AWS.config.update({
    region: 'us-east-1'
})

const dynamodb = new AWS.DynamoDB.DocumentClient();
const dynamodbTableName = 'contacts';
const healthPath = '/health';
const contactPath = '/contact';
const contactsPath = '/contacts';


exports.handler = async function(event) {
    console.log('Request Event: ', event);

    let response;

    switch (true) {
        // Health Check
        case event.httpMethod === 'GET' && event.path === healthPath:
            response = buildResponse(200);
            break;

        // Get all contacts
        case event.httpMethod === 'GET' && event.path === contactsPath:
            response = await getContacts();
            break;

        // Get single contact
        case event.httpMethod === 'GET' && event.path === contactPath:
            response = await getContact(event.queryStringParameters.contactID);
            break;

        // Save new contact
        case event.httpMethod === 'POST' && event.path === contactPath:
            response = await saveContact(JSON.parse(event.body));
            break;

        // Edit existing contact
        case event.httpMethod === 'PUT' && event.path === contactPath:
            const requestBody = JSON.parse(event.body)
            response = await editContact(requestBody.contactID, requestBody.updateKey, requestBody.updateValue);
            break;

        // Delete existing contact
        case event.httpMethod === 'DELETE' && event.path === contactPath:
            response = await deleteContact(JSON.parse(event.body).contactID);
            break;
    }
    return response;
}

function buildResponse(statusCode, body) {
    return {
        statusCode: statusCode,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    }
}

async function getContact(contactID) {
    const params = {
        TableName: dynamodbTableName,
        Key: {
            'contactID': parseInt(contactID)
        }
    }
    return await dynamodb.get(params).promise().then((response) => {
        return buildResponse(200, response.Item);
    }, (error) => console.error(error))
}

async function getContacts() {
    const params = {
        TableName: dynamodbTableName
    }
    const allContacts = await scanDynamorecords(params, []);
    const body = {
        contacts: allContacts
    }
    return buildResponse(200, body);
}

// Recursive function to avoid query limits per call
async function scanDynamorecords(scanParams, itemArray) {
    try {
        const dynamoData = await dynamodb.scan(scanParams).promise();
        itemArray = itemArray.concat(dynamoData.Items);
        if (dynamoData.LastEvaluatedKey) {
            scanParams.ExclusiveStartKey = dynamoData.LastEvaluatedKey;
            return await scanDynamorecords(scanParams, itemArray)
        }
        return itemArray;
    } catch (error) {
        console.error(error)
    }
}

async function saveContact(requestBody) {
    const params = {
        TableName: dynamodbTableName,
        Item: requestBody
    }
    return await dynamodb.put(params).promise().then(() => {
        const body = {
            Operation: 'SAVE',
            Message: 'SUCCESS',
            Item: requestBody
        }
        return buildResponse(200, requestBody);
    }, (error) => console.error(error))
}

async function editContact(contactID, updateKey, updateValue) {
    const params = {
        TableName: dynamodbTableName,
        Key: {
            'contactID': contactID
        },
        UpdateExpression: `set ${updateKey} = :value`,
        ExpressionAttributeValues: {
            ':value': updateValue
        },
        ReturnedValues: 'UPDATED_NEW'
    }
    return await dynamodb.update(params).promise().then((response) => {
        const body = {
            Operation: 'UPDATE',
            Message: 'SUCCESS',
            Item: response
        }
        return buildResponse(200, body);
    }, (error) => console.error(error))
}

async function deleteContact(contact) {
    const params = {
        TableName: dynamodbTableName,
        Key: {
            'contactID': contactID
        },
        ReturnedValues: 'ALL_OLD'
    }
    return await dynamodb.delete(params).promise().then((response) => {
        const body = {
            Operation: 'DELETE',
            Message: 'SUCCESS',
            Item: response
        }
        return buildResponse(200, body);
    }, (error) => console.error(error))
}