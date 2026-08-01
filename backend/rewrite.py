import base64, sys

content = base64.b64decode(sys.argv[1]).decode('utf-8')
filepath = '/opt/whatsapp-crm/backend/src/routes/effect-tracking.js'
with open(filepath, 'w') as f:
    f.write(content)
print('DONE - file written successfully')
