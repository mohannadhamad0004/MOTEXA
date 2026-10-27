#!/usr/bin/env bash
# End-to-end check of the provider onboarding with curl (see provider-onboarding-e2e.md).
# Needs: backend running, the dev seed (audit.tow@ / audit.parts@ admins), node (for JSON). Creates two NEW owners per run.
#   BASE=http://localhost:5055/api bash docs/agents/provider-onboarding-e2e.sh
BASE="${BASE:-http://localhost:5055/api}"
RUN="$(date +%s)"
PW='Owner-Pass-123!'
H='content-type: application/json'
# a 1x1 PNG, and a minimal PDF
PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
PDF="$(printf '%%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%%%EOF' | base64 -w0 2>/dev/null || printf '%%PDF-1.1' | base64)"
fails=0

j() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const o=JSON.parse(s);const v=process.argv[1].split(".").reduce((a,k)=>a==null?a:a[k],o);console.log(typeof v==="object"?JSON.stringify(v):v)}catch{console.log("")}})' "$1"; }
call() { # method path token [json]  -> sets $CODE and $BODY
  local m="$1" p="$2" t="$3" d="$4" out
  if [ -n "$d" ]; then out=$(curl -s -w '\n%{http_code}' -X "$m" "$BASE$p" -H "$H" ${t:+-H "authorization: Bearer $t"} -d "$d"); else out=$(curl -s -w '\n%{http_code}' -X "$m" "$BASE$p" ${t:+-H "authorization: Bearer $t"}); fi
  CODE="${out##*$'\n'}"; BODY="${out%$'\n'*}"
}
expect() { # label expectedCode [needle]
  if [ "$CODE" = "$2" ] && { [ -z "$3" ] || echo "$BODY" | grep -q "$3"; }; then echo "  ok   $1 -> $CODE"; else echo "  FAIL $1 -> $CODE (wanted $2 $3) $(echo "$BODY" | cut -c1-200)"; fails=$((fails+1)); fi
}
login() { call POST /auth/login "" "{\"email\":\"$1\",\"password\":\"$2\"}"; echo "$BODY" | j accessToken; }

ADMIN_TOW="$(login audit.tow@motexa.test 'Audit-Tow-Pass-123!')"
ADMIN_PARTS="$(login audit.parts@motexa.test 'Audit-Parts-Pass-123!')"
CUSTOMER="$(login customer@motexa.test 'Motexa-Dev-1234!')"
[ -n "$ADMIN_TOW" ] && [ -n "$ADMIN_PARTS" ] || { echo "Admin logins failed: create audit.tow@ / audit.parts@ first."; exit 1; }

doc() { echo "{\"kind\":\"$1\",\"name\":\"$2\",\"dataBase64\":\"$3\"}"; }

# ===================================================================== TOW
echo "== TOW: register -> step 1 -> docs -> submit"
TEMAIL="e2e.tow.$RUN@motexa.test"
call POST /auth/provider/register "" "{\"kind\":\"TOW\",\"fullName\":\"E2E Tow Owner\",\"businessName\":\"E2E Towing $RUN\",\"email\":\"$TEMAIL\",\"phoneNumber\":\"+970 59 555 0101\",\"city\":\"Ramallah\",\"password\":\"$PW\",\"acceptTerms\":true}"; expect "register tow owner" 201
call POST /auth/provider/register "" "{\"kind\":\"TOW\",\"fullName\":\"X\",\"businessName\":\"A\",\"email\":\"bad\",\"phoneNumber\":\"1\",\"city\":\"x\",\"password\":\"weak\",\"acceptTerms\":true}"; expect "weak registration refused" 400
OWNER="$(login "$TEMAIL" "$PW")"
call GET /provider/onboarding "$OWNER"; expect "owner sees a DRAFT application" 200 '"status":"DRAFT"'
TID="$(echo "$BODY" | j application.id)"
call PATCH /tow/me/requests/none/accept "$OWNER" '{}'; expect "unapproved provider: accept request refused" 403 "not been approved"
call GET /tow/me/requests "$OWNER"; expect "unapproved provider: request list refused" 403
call PUT /provider/onboarding/info "$OWNER" '{"nameAr":"السحب السريع","ownerName":"E2E Tow Owner","phone":"+970 59 555 0101","city":"Ramallah","address":"Al-Masyoun","serviceCities":["Ramallah","Al-Bireh"],"baseLat":31.9038,"baseLng":35.2034,"open24h":true,"truckTypes":["FLATBED"],"truckCountClaimed":1}'; expect "step 1 saved" 200
call POST /provider/onboarding/submit "$OWNER"; expect "submit with missing items refused" 400 "missing"
call POST /tow/me/trucks "$OWNER" "{\"truckType\":\"FLATBED\",\"plateNumber\":\"E2E-$RUN\",\"make\":\"Isuzu\",\"model\":\"NPR\",\"year\":2022,\"photo\":{\"name\":\"photo.png\",\"dataBase64\":\"$PNG\"},\"documents\":[{\"kind\":\"REGISTRATION\",\"name\":\"licence.png\",\"dataBase64\":\"$PNG\"},{\"kind\":\"INSURANCE\",\"name\":\"insurance.png\",\"dataBase64\":\"$PNG\"}]}"; expect "truck with photo + licence + insurance" 201
call POST /provider/onboarding/documents "$OWNER" "$(doc COMMERCIAL_REGISTRATION reg.png $PNG)"; expect "upload commercial registration (PNG)" 201
call POST /provider/onboarding/documents "$OWNER" "$(doc OWNER_ID id.pdf "$PDF")"; expect "upload owner ID (PDF)" 201
call POST /provider/onboarding/documents "$OWNER" "$(doc OWNER_ID id.png "$(printf 'not an image' | base64)")"; expect "wrong file type refused" 400
call POST /provider/onboarding/documents "$OWNER" "$(doc DRIVER_LICENCE drv.png $PNG)"; expect "upload driver licence" 201
call POST /provider/onboarding/submit "$OWNER"; expect "submit" 200 '"status":"PENDING"'
call PUT /provider/onboarding/info "$OWNER" '{"phone":"+970 59 000 0000"}'; expect "edit after submit refused" 409

echo "== TOW: department review"
call GET /admin/providers/tow/counts "$ADMIN_TOW"; expect "counts" 200 '"NEW"'
call GET "/admin/providers/tow/applications?tab=NEW" "$ADMIN_TOW"; expect "application is in New" 200 "E2E Towing $RUN"
call GET /admin/providers/tow/applications/$TID "$ADMIN_PARTS"; expect "parts admin on a tow application" 403
call GET /admin/providers/parts/applications "$ADMIN_TOW"; expect "tow admin on parts applications" 403
call GET /admin/providers/tow/applications/$TID "$OWNER"; expect "the owner is not an admin" 403
call POST /admin/providers/tow/applications/$TID/approve "$ADMIN_TOW"; expect "approve before the checklist is complete refused" 409 "checklist"
call GET /admin/providers/tow/applications/$TID "$ADMIN_TOW"; DETAIL="$BODY"; expect "detail" 200 '"checklist"'
OWNERID="$(echo "$DETAIL" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).application.documents.find(d=>d.kind==="OWNER_ID").id')"
call POST /admin/providers/tow/applications/$TID/request-changes "$ADMIN_TOW" '{"message":""}'; expect "request changes needs a message" 400
call POST /admin/providers/tow/applications/$TID/request-changes "$ADMIN_TOW" "{\"message\":\"Please upload a clearer owner ID.\",\"fields\":[\"phone\"],\"documentIds\":[\"$OWNERID\"]}"; expect "request changes" 200 '"status":"NEEDS_CHANGES"'
call GET /provider/onboarding "$OWNER"; expect "owner sees NEEDS_CHANGES + flagged items" 200 'doc:OWNER_ID'
call GET /provider/messages "$OWNER"; expect "owner reads the admin message" 200 "clearer owner ID"
call POST /provider/messages "$OWNER" '{"body":"Uploading a new copy now."}'; expect "owner replies" 201
call POST /provider/onboarding/submit "$OWNER"; expect "resubmit with the rejected document still there refused" 400 "rejected"
call POST /provider/onboarding/documents "$OWNER" "$(doc OWNER_ID id2.png $PNG)"; expect "owner replaces the owner ID" 201
call POST /provider/onboarding/submit "$OWNER"; expect "resubmit" 200 '"status":"PENDING"'
call GET "/admin/providers/tow/applications?tab=NEW" "$ADMIN_TOW"; expect "back in New" 200 "E2E Towing $RUN"
call GET /admin/providers/tow/applications/$TID/messages "$ADMIN_TOW"; expect "admin reads the owner reply" 200 "Uploading a new copy"
call GET /catalog/tow/companies "$CUSTOMER"; echo "$BODY" | grep -q "E2E Towing $RUN" && { echo "  FAIL customers already see the unapproved company"; fails=$((fails+1)); } || echo "  ok   not visible to customers before approval"
call GET /admin/providers/tow/applications/$TID "$ADMIN_TOW"; DETAIL="$BODY"
for D in $(echo "$DETAIL" | node -pe 'const a=JSON.parse(require("fs").readFileSync(0,"utf8")).application;[...a.documents,...a.trucks.flatMap(t=>t.documents)].map(d=>d.id).join(" ")'); do
  call PATCH /admin/providers/tow/applications/$TID/documents/$D "$ADMIN_TOW" '{"status":"ACCEPTED"}'; [ "$CODE" = 200 ] || { echo "  FAIL accept $D -> $CODE $BODY"; fails=$((fails+1)); }
done; echo "  ok   all documents accepted"
call PATCH /admin/providers/tow/applications/$TID/documents/$OWNERID "$ADMIN_TOW" '{"status":"REJECTED"}'; expect "reject a document needs a reason" 400
call POST /admin/providers/tow/applications/$TID/approve "$ADMIN_PARTS"; expect "parts admin cannot approve a tow company" 403
call POST /admin/providers/tow/applications/$TID/approve "$ADMIN_TOW"; expect "approve" 200 '"status":"APPROVED"'
call GET /catalog/tow/companies "$CUSTOMER"; echo "$BODY" | grep -q "E2E Towing $RUN" && echo "  ok   company is now visible to customers" || { echo "  FAIL approved company not visible to customers"; fails=$((fails+1)); }
call GET /tow/me/requests "$OWNER"; expect "approved provider can use provider actions" 200
call GET /provider/messages "$OWNER"; expect "thread stays after approval" 200 "approved"
call GET /notifications "$OWNER"; expect "notifications created" 200 '"unread"'

echo "== TOW: messages with an attachment (stays after approval)"
call POST /provider/messages "$OWNER" "{\"body\":\"Here is a photo.\",\"attachment\":{\"name\":\"photo.png\",\"dataBase64\":\"$PNG\"}}"; expect "owner sends an attachment" 201
ATT="$(echo "$BODY" | node -pe 'const m=JSON.parse(require("fs").readFileSync(0,"utf8")).messages.filter(x=>x.attachments.length).pop();m.attachments[0].uri.split("/").pop()')"
call GET "/files/private/$ATT" "$OWNER"; [ "$CODE" = 200 ] && echo "  ok   owner opens the attachment" || { echo "  FAIL owner attachment -> $CODE"; fails=$((fails+1)); }
call GET "/files/private/$ATT" "$ADMIN_TOW"; [ "$CODE" = 200 ] && echo "  ok   tow admin opens the attachment" || { echo "  FAIL tow admin attachment -> $CODE"; fails=$((fails+1)); }
call GET "/files/private/$ATT" "$ADMIN_PARTS"; expect "parts admin cannot open a tow attachment" 403
call POST /admin/providers/tow/applications/$TID/messages "$ADMIN_TOW" '{"body":"Welcome aboard."}'; expect "admin replies after approval" 201
call GET /admin/providers/tow/applications/$TID/messages "$ADMIN_TOW"; expect "admin reads (marks read next)" 200 "Here is a photo"
call POST /admin/providers/tow/applications/$TID/messages/read "$ADMIN_TOW"; expect "mark read" 200
call GET /provider/onboarding/status "$OWNER"; expect "owner sees an unread badge" 200 '"unreadMessages":[1-9]'
call POST /provider/messages/read "$OWNER"; expect "owner marks read" 200
call GET /provider/onboarding/status "$OWNER"; expect "badge cleared" 200 '"unreadMessages":0'

# ===================================================================== PARTS
echo "== PARTS: register -> step 1 -> docs -> submit -> review -> approve"
SEMAIL="e2e.shop.$RUN@motexa.test"
call POST /auth/provider/register "" "{\"kind\":\"PARTS\",\"fullName\":\"E2E Shop Owner\",\"businessName\":\"E2E Parts $RUN\",\"email\":\"$SEMAIL\",\"phoneNumber\":\"+970 59 555 0202\",\"city\":\"Nablus\",\"password\":\"$PW\",\"acceptTerms\":true}"; expect "register shop owner" 201
SOWNER="$(login "$SEMAIL" "$PW")"
call GET /provider/onboarding "$SOWNER"; SID="$(echo "$BODY" | j application.id)"
call POST /parts/me/products "$SOWNER" '{}'; expect "unapproved shop: product creation refused" 403 "not been approved"
call GET /parts/me/inquiries "$SOWNER"; expect "unapproved shop: inquiries refused" 403
call PUT /provider/onboarding/info "$SOWNER" '{"nameAr":"قطع الغيار","ownerName":"E2E Shop Owner","phone":"+970 59 555 0202","city":"Nablus","address":"Rafidia","baseLat":32.2211,"baseLng":35.2544,"categories":["BRAKE_SYSTEM"],"brands":["Bosch"],"workingHours":"Sat-Thu 08:00-19:00"}'; expect "step 1 saved" 200
for K in STOREFRONT_PHOTO COMMERCIAL_REGISTRATION TRADE_LICENCE OWNER_ID; do call POST /provider/onboarding/documents "$SOWNER" "$(doc $K $K.png $PNG)"; expect "upload $K" 201; done
call POST /provider/onboarding/submit "$SOWNER"; expect "submit" 200 '"status":"PENDING"'
call POST /admin/providers/parts/applications/$SID/approve "$ADMIN_PARTS"; expect "approve before the checklist is complete refused" 409 "checklist"
call GET /admin/providers/parts/applications/$SID "$ADMIN_TOW"; expect "tow admin on a parts application" 403
call GET /admin/providers/parts/applications/$SID "$ADMIN_PARTS"; DETAIL="$BODY"; expect "detail" 200
for D in $(echo "$DETAIL" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).application.documents.map(d=>d.id).join(" ")'); do call PATCH /admin/providers/parts/applications/$SID/documents/$D "$ADMIN_PARTS" '{"status":"ACCEPTED"}'; done
call POST /admin/providers/parts/applications/$SID/reject "$ADMIN_PARTS" '{}'; expect "reject needs a reason" 400
call POST /admin/providers/parts/applications/$SID/approve "$ADMIN_PARTS"; expect "approve" 200 '"status":"APPROVED"'
call GET /catalog/shops "$CUSTOMER"; echo "$BODY" | grep -q "E2E Parts $RUN" && echo "  ok   shop is now visible to customers" || { echo "  FAIL approved shop not visible to customers"; fails=$((fails+1)); }
call GET /admin/providers/parts/threads "$ADMIN_PARTS"; expect "messages: thread list" 200 "E2E Parts $RUN"

echo "== files are private"
FILEURI="$(echo "$DETAIL" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).application.documents[0].uri')"
call GET "/files/private/${FILEURI##*/}" "$ADMIN_TOW"; expect "tow admin cannot open a shop document" 403
call GET "/files/private/${FILEURI##*/}" "$CUSTOMER"; expect "customer cannot open a shop document" 403
call GET "/files/private/${FILEURI##*/}" "$ADMIN_PARTS"; [ "$CODE" = 200 ] && echo "  ok   parts admin opens it -> 200" || { echo "  FAIL parts admin -> $CODE"; fails=$((fails+1)); }

echo; [ "$fails" = 0 ] && echo "ALL CHECKS PASSED" || echo "$fails CHECK(S) FAILED"
echo "Owners created this run: $TEMAIL / $SEMAIL (password $PW)"
exit "$fails"
