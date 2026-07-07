# Saint-Gobain Sales System Apps Script Backend

This folder is the backend source of truth for Google Apps Script.

## Copy order

Copy these files into the Apps Script project:

1. `Constants.gs`
2. `Response.gs`
3. `Logger.gs`
4. `Config.gs`
5. `Database.gs`
6. `Validator.gs`
7. `Permission.gs`
8. `User.gs`
9. `Auth.gs`
10. `Customer.gs`
11. `Product.gs`
12. `Discount.gs`
13. `Quotation.gs`
14. `Code.gs`
15. `Api.gs`

Apps Script uses one shared global scope, so keep shared constants only in `Constants.gs` and shared configuration helpers only in `Config.gs`.

## Do not copy frontend code here

Do not paste browser/frontend code into Apps Script backend files:

- no `window`
- no `document`
- no `fetch`
- no `google.script.run`
- no frontend `mockApi`
- no frontend `js/api.js`

## Deploy

1. Save every Apps Script file.
2. Set script property `SPREADSHEET_ID` if this is a standalone Web App.
3. Deploy > Manage deployments.
4. Edit the Web App deployment.
5. Choose `New version`.
6. Deploy.
7. Test the `/exec` URL. `GET` should return JSON with `API Running`.
