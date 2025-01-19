import os
from flask import Flask, jsonify
from flask_cors import CORS
import requests
import json

app = Flask(__name__)

CORS(app, resources={r"/*": {"origins": "*"}})

RPC_USER = os.getenv("RPC_USER", "testuser")
RPC_PASSWORD = os.getenv("RPC_PASS", "testpass")
RPC_IP = os.getenv("RPC_IP", "127.0.0.1")
RPC_PORT = os.getenv("RPC_PORT", "9332")
RPC_URL = f"http://{RPC_IP}:{RPC_PORT}"

def rpc_request(method, params=[]):
    headers = {'content-type': 'application/json'}
    payload = json.dumps({"method": method, "params": params, "id": 1})
    response = requests.post(RPC_URL, auth=(RPC_USER, RPC_PASSWORD), data=payload, headers=headers)
    return response.json()

@app.route("/getconnectioncount")
def getconnectioncount():
    getconnectioncount = rpc_request("getconnectioncount")["result"]
    return jsonify(getconnectioncount)

@app.route("/getnetworkhashps")
def network_hashrate():
    network_hashrate_hs = rpc_request("getnetworkhashps")["result"]
    network_hashrate_ths = round(network_hashrate_hs / 1e12, 1)
    return jsonify(network_hashrate_ths)

@app.route("/getblockchaininfo")
def blockchain_info():
    blockchain_info = rpc_request("getblockchaininfo")["result"]
    chain_size_gb = round(blockchain_info["size_on_disk"] / 1e9, 1)
    return jsonify(chain_size_gb)

@app.route("/getmempoolinfo")
def mempool_info():
    mempool_info = rpc_request("getmempoolinfo")["result"]
    mempool_size_kb = round(mempool_info["bytes"] / 1e3, 1)
    return jsonify(mempool_size_kb)

@app.route("/getblockheight")
def block_height():
    blockchain_info = rpc_request("getblockchaininfo")["result"]
    block_height = blockchain_info["blocks"]
    return jsonify(block_height)

@app.route("/getsyncprogress")
def sync_progress():
    blockchain_info = rpc_request("getblockchaininfo")["result"]
    verification_progress = round(blockchain_info["verificationprogress"] * 100, 1)
    return jsonify(verification_progress)

@app.route("/getblocktransactions/<int:block_number>")
def block_transactions(block_number):
    block_hash = rpc_request("getblockhash", [block_number])["result"]
    block_info = rpc_request("getblock", [block_hash, 2])["result"]
    transaction_count = len(block_info["tx"])
    return jsonify(transaction_count)

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)
