import json
import pymongo
import os

client = pymongo.MongoClient(os.environ['MONGO_URI'])
db = client['prana_console-develop']

def lambda_handler(event, context):

    body = json.loads(event["body"])

    collection_name = body["collection"]
    operation = body["operation"]

    collection = db[collection_name]

    if operation == "find":
        query = body.get("query", {})
        result = list(collection.find(query))
        for r in result:
            r["_id"] = str(r["_id"])
        return response(result)

    elif operation == "insert":
        data = body["data"]
        result = collection.insert_one(data)
        return response({"inserted_id": str(result.inserted_id)})

    elif operation == "update":
        query = body["query"]
        update = {"$set": body["data"]}
        result = collection.update_many(query, update)
        return response({"updated": result.modified_count})

    elif operation == "delete":
        query = body["query"]
        result = collection.delete_many(query)
        return response({"deleted": result.deleted_count})

    else:
        return response({"error": "Invalid operation"})


def response(data):
    return {
        "statusCode": 200,
        "body": json.dumps(data)
    }