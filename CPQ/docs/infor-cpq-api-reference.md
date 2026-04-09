# Infor CPQ API reference (from documentation screenshots)

This document consolidates **Infor CPQ** API material captured from developer documentation screenshots. Paths are shown relative to each API’s base URL unless a full host is given. **Treat this as working notes**: confirm URLs, headers, and payloads against the official Infor developer portal and your tenant configuration before production use.

**§1** is a verbatim-style extract from the **Product Configurator UI** and **3D Async Rules / QBuildCallback** page; **§2** from the Enterprise Quoting API page; **§5** from the **scripting API** (`cpq` global). **§3** and **§4** remain paraphrased from an earlier capture until replaced.

**Authentication:** §2 documents `POST /auth/login` plus `Bearer` on subsequent requests; other sections may only mention Bearer.

---

## 1. Product Configurator UI & QBuildCallback (3D async rules)

*Verbatim extract from documentation screenshot — Infor CPQ, Product Configurator UI and 3D Async Rules.*

Page layout: left column — endpoint titles and parameter details; right column — cURL and response examples.

**Host (from cURL examples):** `https://mingle-ionapi.inforcloudsuite.com`

### 1.1 Product Configurator UI Save Full Configuration

**Description:** Endpoint to save the full configuration.

**Response:** `204` Object

**Request (cURL):**

```bash
curl --location --request POST 'https://mingle-ionapi.inforcloudsuite.com/ProductConfiguratorUI/SaveFullConfiguration'
```

**Response Code:** `204`

### 1.2 Product Configurator UI Cancel Configuration

**Description:** Endpoint to cancel the current configuration session.

**Response:** `204` Object

**Request (cURL):**

```bash
curl --location --request POST 'https://mingle-ionapi.inforcloudsuite.com/ProductConfiguratorUI/CancelConfiguration'
```

**Response Code:** `204`

### 1.3 Product Configurator UI Save Output File

**Body Parameters:**

- `sessionId`: string (REQUIRED). Min length: 32.
- `outputFile`: string.

**Request (cURL):**

```bash
curl --location --request POST 'https://mingle-ionapi.inforcloudsuite.com/ProductConfiguratorUI/SaveOutputFile' \
--data '{
  "sessionId": "",
  "outputFile": ""
}'
```

### 1.4 3D Async Rules Success Callback (first instance)

**Path Parameters:**

- `asyncRule`: string (REQUIRED).

**Request (cURL):**

```bash
curl --location --request POST 'https://mingle-ionapi.inforcloudsuite.com/qbuildcallback/asyncrule/{asyncRule}/sessionid/{qbuildSessionId}/success'
```

### 1.5 QBuildCallback

*(Section header in the documentation.)*

### 1.6 3D Async Rules Success Callback (detailed instance)

**Path Parameters:**

- `asyncRule`: string (REQUIRED).
- `sessionId`: string (REQUIRED).
- `qbuildSessionId`: string (REQUIRED).

**Response:** `200` Object

**Request (cURL):**

```bash
curl --location --request POST 'https://mingle-ionapi.inforcloudsuite.com/qbuildcallback/asyncrule/{asyncRule}/sessionid/{qbuildSessionId}/success'
```

**Response Code:** `200`

### 1.7 3D Async Rules Failed Callback

Only the header for this section is visible at the bottom of the image; body/path details not shown in the capture.

**Source image:** `screencapture-developer-infor-api-v4-configoutput-2026-03-31-23_40_21-3-224e7fd2-2025-40fe-ab2e-2555254a8516.png` (Cursor project `assets/` folder).

---

## 2. Infor CPQ Enterprise Quoting API

*Verbatim extract from documentation screenshot (2026-03-31).*

**Title:** Infor CPQ Enterprise Quoting API

**Breadcrumbs:** Home > Infor CPQ Enterprise Quoting API

**Base URL:** `https://[tenant].cpq.infor.com/api/v1`

**Overview:** The Enterprise Quoting API allows developers to programmatically manage the lifecycle of a quote, from creation and customer assignment to product configuration and finalization.

### 2.1 Authentication

All requests must include a Bearer token in the `Authorization` header.

**Endpoint:** `POST /auth/login`

**Request Body (JSON):**

```json
{
  "username": "[username]",
  "password": "[password]"
}
```

**Response (JSON):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

### 2.2 Quotes resource

#### Create Quote

**Method:** `POST /quotes`

**Description:** Creates a new quote header.

**Request Parameters (Body):**

- `customerCode` (string, Required): The unique identifier for the customer.
- `name` (string, Optional): A descriptive name for the quote.
- `currencyCode` (string, Optional): ISO currency code (e.g., "USD").
- `priceListId` (string, Optional): The ID of a specific price list to apply.

**Response (201 Created):** Returns the created Quote object including a generated `id` and `quoteNumber`.

#### Get Quote

**Method:** `GET /quotes/{id}`

**Description:** Retrieves the details of a specific quote by its unique ID.

**Path Parameters:**

- `id` (string): The unique identifier of the quote.

**Response (200 OK):** A JSON object containing quote header details, totals, and status.

#### Update Quote

**Method:** `PATCH /quotes/{id}`

**Description:** Updates specific fields of an existing quote.

**Request Body:** Can include `name`, `description`, `status`, or `expirationDate`.

#### List Quotes

**Method:** `GET /quotes`

**Description:** Returns a paginated list of quotes.

**Query Parameters:**

- `limit` (integer): Number of records to return.
- `offset` (integer): Number of records to skip.
- `filter` (string): OData-style filter string (e.g., `status eq 'Draft'`).

### 2.3 Line items resource

#### Add Line Item

**Method:** `POST /quotes/{id}/line-items`

**Description:** Adds a product to the specified quote.

**Request Body:**

- `productCode` (string, Required): The SKU or product identifier.
- `quantity` (number, Required): The quantity to add.

**Response (201 Created):** Returns the `lineItemId`.

#### Update Line Item

**Method:** `PATCH /quotes/{id}/line-items/{lineItemId}`

**Description:** Modifies properties of a line item, such as quantity.

#### Delete Line Item

**Method:** `DELETE /quotes/{id}/line-items/{lineItemId}`

**Description:** Removes a line item from the quote.

### 2.4 Configuration resource

*This section deals with the interactive configuration of complex products.*

#### Get Configuration

**Method:** `GET /quotes/{id}/line-items/{lineItemId}/configuration`

**Description:** Retrieves the current configuration state for a configurable line item.

**Response Body:** Includes a tree structure of `features` and `options`, indicating which are selected, available, or hidden based on rules.

#### Update Configuration (Select Options)

**Method:** `PATCH /quotes/{id}/line-items/{lineItemId}/configuration`

**Description:** Updates the configuration by selecting or deselecting options.

**Request Body:**

```json
{
  "selections": [
    {
      "feature": "COLOR",
      "option": "RED"
    },
    {
      "feature": "SIZE",
      "option": "LARGE"
    }
  ]
}
```

#### Validate Configuration

**Method:** `POST /quotes/{id}/line-items/{lineItemId}/configuration/validate`

**Description:** Checks the current configuration against product rules.

**Response:** Returns a list of `messages` (errors, warnings, or info) and a `isValid` boolean.

### 2.5 Data models (schemas)

**Quote Object:**

- `id`: UUID
- `quoteNumber`: String
- `status`: String (Draft, Finalized, Expired)
- `totalAmount`: Number
- `customer`: Object (code, name)

**LineItem Object:**

- `lineItemId`: UUID
- `productCode`: String
- `unitPrice`: Number
- `quantity`: Number
- `isConfigurable`: Boolean

### 2.6 Footer (page)

© 2024 Infor. All rights reserved.

Documentation Home, Support, API Terms of Service.

**Source image:** `screencapture-developer-infor-api-v4-configoutput-2026-03-31-23_40_21-c5569005-34ad-41e5-b602-f5a2ef89209b.png` (Cursor project `assets/` folder).

---

## 3. CPQ REST API — Configurator

These endpoints manage **configuration models** and **sessions** (documentation showed `/api/v1/configurator/...`).

### 3.1 Models

#### List models

| Method | Path |
|--------|------|
| `GET` | `/api/v1/configurator/models` |

**Query parameters (illustrative)**

| Parameter | Type | Description |
|-----------|------|-------------|
| `skip` | integer | Offset for paging. |
| `take` | integer | Page size. |
| `filter` | string | Filter expression. |

**Response (illustrative):** array of models with `id`, `name`, `description`.

#### Get model by ID

| Method | Path |
|--------|------|
| `GET` | `/api/v1/configurator/models/{id}` |

---

### 3.2 Sessions

#### Start session

| Method | Path |
|--------|------|
| `POST` | `/api/v1/configurator/sessions` |

**Request body (illustrative):** includes `modelId`.

**Response (illustrative):** `201 Created` with `sessionId`.

#### Get session

| Method | Path |
|--------|------|
| `GET` | `/api/v1/configurator/sessions/{id}` |

Returns full session state (selections, valid options, etc.).

#### Update session

| Method | Path |
|--------|------|
| `PATCH` | `/api/v1/configurator/sessions/{id}` |

**Request body (illustrative):** array of changes.

```json
[
  { "name": "Color", "value": "Red" }
]
```

#### Delete session

| Method | Path |
|--------|------|
| `DELETE` | `/api/v1/configurator/sessions/{id}` |

**Success:** `204 No Content`.

#### Evaluate rules

| Method | Path |
|--------|------|
| `POST` | `/api/v1/configurator/sessions/{id}/actions/evaluate` |

Manually triggers rule evaluation.

#### Finish session

| Method | Path |
|--------|------|
| `POST` | `/api/v1/configurator/sessions/{id}/actions/finish` |

Finalizes configuration (e.g. configured string / BOM — confirm in official docs).

#### Session UI metadata

| Method | Path |
|--------|------|
| `GET` | `/api/v1/configurator/sessions/{id}/ui` |

Returns UI-oriented metadata (labels, groupings, visibility).

---

## 4. CPQ REST API — Enterprise (projects and items)

### 4.1 Projects

#### List projects

| Method | Path |
|--------|------|
| `GET` | `/api/v1/enterprise/projects` |

Supports pagination via `skip` and `take` (per screenshot summary).

#### Create project

| Method | Path |
|--------|------|
| `POST` | `/api/v1/enterprise/projects` |

**Request body (illustrative):** `name`, `customer`, `status`, etc.

#### Get project

| Method | Path |
|--------|------|
| `GET` | `/api/v1/enterprise/projects/{id}` |

#### Update project

| Method | Path |
|--------|------|
| `PUT` | `/api/v1/enterprise/projects/{id}` |

#### Delete project

| Method | Path |
|--------|------|
| `DELETE` | `/api/v1/enterprise/projects/{id}` |

---

### 4.2 Project items

#### List items

| Method | Path |
|--------|------|
| `GET` | `/api/v1/enterprise/projects/{id}/items` |

#### Add item

| Method | Path |
|--------|------|
| `POST` | `/api/v1/enterprise/projects/{id}/items` |

**Request body (illustrative):** often populated from a **finished** configurator session.

#### Get / update / delete item

| Method | Path |
|--------|------|
| `GET` | `/api/v1/enterprise/projects/{id}/items/{itemId}` |
| `PUT` | `/api/v1/enterprise/projects/{id}/items/{itemId}` |
| `DELETE` | `/api/v1/enterprise/projects/{id}/items/{itemId}` |

---

## 5. Infor CPQ scripting API — global `cpq` object

*Verbatim extract from documentation screenshot (Configure, Price, Quote scripting API).*

Technical documentation for the **Infor CPQ (Configure, Price, Quote)** scripting API. It details various methods available on a global `cpq` object used for interacting with the configuration engine and user interface.

Each method below follows the doc structure: **description**, **parameters**, **return value** (if applicable), **example**.

### Get Feature Selection

**Description:** Returns the name of the selected option for the specified feature.

**Parameters:**

- `featureName` (String): The name of the feature.

**Return Value:** String

**Example:**

```javascript
var selection = cpq.getFeatureSelection("Color");
```

### Set Feature Selection

**Description:** Sets the selection for the specified feature and option.

**Parameters:**

- `featureName` (String): The name of the feature.
- `optionName` (String): The name of the option to select.
- `isSelected` (Boolean): True to select the option, false to deselect.

**Example:**

```javascript
cpq.setFeatureSelection("Color", "Red", true);
```

### Get Option Property

**Description:** Returns the value of the specified property for the given feature and option.

**Parameters:**

- `featureName` (String): The name of the feature.
- `optionName` (String): The name of the option.
- `propertyName` (String): The name of the property to retrieve.

**Return Value:** Object

**Example:**

```javascript
var price = cpq.getOptionProperty("Color", "Red", "Price");
```

### Get Feature Property

**Description:** Returns the value of the specified property for the given feature.

**Parameters:**

- `featureName` (String): The name of the feature.
- `propertyName` (String): The name of the property to retrieve.

**Return Value:** Object

**Example:**

```javascript
var visible = cpq.getFeatureProperty("Color", "Visible");
```

### Set Feature Property

**Description:** Sets the value of the specified property for the given feature.

**Parameters:**

- `featureName` (String): The name of the feature.
- `propertyName` (String): The name of the property to set.
- `value` (Object): The value to set for the property.

**Example:**

```javascript
cpq.setFeatureProperty("Color", "Visible", false);
```

### Get Configuration Property

**Description:** Returns the value of the specified configuration-level property.

**Parameters:**

- `propertyName` (String): The name of the property to retrieve.

**Return Value:** Object

**Example:**

```javascript
var total = cpq.getConfigurationProperty("TotalPrice");
```

### Set Configuration Property

**Description:** Sets the value of the specified configuration-level property.

**Parameters:**

- `propertyName` (String): The name of the property to set.
- `value` (Object): The value to set for the property.

**Example:**

```javascript
cpq.setConfigurationProperty("CustomNote", "Special order");
```

### Get Global Property

**Description:** Returns the value of the specified global property.

**Parameters:**

- `propertyName` (String): The name of the property to retrieve.

**Return Value:** Object

**Example:**

```javascript
var lang = cpq.getGlobalProperty("Language");
```

### Set Global Property

**Description:** Sets the value of the specified global property.

**Parameters:**

- `propertyName` (String): The name of the property to set.
- `value` (Object): The value to set for the property.

**Example:**

```javascript
cpq.setGlobalProperty("UserRole", "Admin");
```

### Execute Rule

**Description:** Executes the specified rule.

**Parameters:**

- `ruleName` (String): The name of the rule to execute.

**Example:**

```javascript
cpq.executeRule("CalculateShipping");
```

### Refresh UI

**Description:** Refreshes the CPQ user interface to reflect any changes made via script.

**Example:**

```javascript
cpq.refreshUI();
```

### Get All Features

**Description:** Returns an array containing the names of all features in the configuration.

**Return Value:** Array (String)

**Example:**

```javascript
var features = cpq.getAllFeatures();
```

### Get Options for Feature

**Description:** Returns an array containing the names of all options for the specified feature.

**Parameters:**

- `featureName` (String): The name of the feature.

**Return Value:** Array (String)

**Example:**

```javascript
var options = cpq.getOptionsForFeature("Color");
```

### Get Selected Options for Feature

**Description:** Returns an array containing the names of all currently selected options for the specified feature.

**Parameters:**

- `featureName` (String): The name of the feature.

**Return Value:** Array (String)

**Example:**

```javascript
var selections = cpq.getSelectedOptionsForFeature("Color");
```

### Is Option Selected

**Description:** Checks if a specific option is currently selected for a feature.

**Parameters:**

- `featureName` (String): The name of the feature.
- `optionName` (String): The name of the option.

**Return Value:** Boolean

**Example:**

```javascript
var isRed = cpq.isOptionSelected("Color", "Red");
```

### Get Feature Type

**Description:** Returns the type of the specified feature (e.g., "SingleSelect", "MultiSelect").

**Parameters:**

- `featureName` (String): The name of the feature.

**Return Value:** String

**Example:**

```javascript
var type = cpq.getFeatureType("Color");
```

### Get Feature Label

**Description:** Returns the display label for the specified feature.

**Parameters:**

- `featureName` (String): The name of the feature.

**Return Value:** String

**Example:**

```javascript
var label = cpq.getFeatureLabel("Color");
```

### Get Option Label

**Description:** Returns the display label for the specified option.

**Parameters:**

- `featureName` (String): The name of the feature.
- `optionName` (String): The name of the option.

**Return Value:** String

**Example:**

```javascript
var label = cpq.getOptionLabel("Color", "Red");
```

### Show Message

**Description:** Displays a message to the user in the CPQ interface.

**Parameters:**

- `message` (String): The message text to display.
- `type` (String, optional): The type of message (e.g., "info", "warning", "error"). Defaults to "info".

**Example:**

```javascript
cpq.showMessage("Configuration saved.", "info");
```

### Clear Messages

**Description:** Clears all currently displayed messages from the CPQ interface.

**Example:**

```javascript
cpq.clearMessages();
```

### Get Current User

**Description:** Returns information about the currently logged-in user.

**Return Value:** Object

**Example:**

```javascript
var user = cpq.getCurrentUser();
```

### Get Current Date

**Description:** Returns the current date and time.

**Return Value:** Date

**Example:**

```javascript
var now = cpq.getCurrentDate();
```

### Format Number

**Description:** Formats a number according to the current locale and specified options.

**Parameters:**

- `value` (Number): The number to format.
- `options` (Object, optional): Formatting options.

**Return Value:** String

**Example:**

```javascript
var formatted = cpq.formatNumber(1234.56, { decimalPlaces: 2 });
```

### Parse Number

**Description:** Parses a formatted number string into a numeric value.

**Parameters:**

- `value` (String): The formatted number string.

**Return Value:** Number

**Example:**

```javascript
var num = cpq.parseNumber("1,234.56");
```

### Log

**Description:** Logs a message to the browser's console or a server-side log.

**Parameters:**

- `message` (String): The message to log.
- `level` (String, optional): The log level.

**Example:**

```javascript
cpq.log("Rule execution started.", "info");
```

**Source image:** `screencapture-developer-infor-api-v4-configoutput-2026-03-31-23_40_21-2-2cef40a1-107f-41a1-b496-b6b3816b2bfb.png` (Cursor project `assets/` folder).

---

## Source screenshots (workspace)

The following files were saved from the original captures and can be re-opened for visual verification (Cursor project `assets/` folder):

- `/Users/yasas.karunarathna/.cursor/projects/Users-yasas-karunarathna-Work-Brompton-sources-brompton-trade/assets/screencapture-developer-infor-api-v4-configoutput-2026-03-31-23_40_21-3-224e7fd2-2025-40fe-ab2e-2555254a8516.png` — **Product Configurator UI & QBuildCallback** (verbatim extract → §1)  
- `/Users/yasas.karunarathna/.cursor/projects/Users-yasas-karunarathna-Work-Brompton-sources-brompton-trade/assets/screencapture-developer-infor-api-v4-configoutput-2026-03-31-23_40_21-2-2cef40a1-107f-41a1-b496-b6b3816b2bfb.png` — **Infor CPQ scripting API** (`cpq` object → §5)  
- `/Users/yasas.karunarathna/.cursor/projects/Users-yasas-karunarathna-Work-Brompton-sources-brompton-trade/assets/screencapture-developer-infor-api-v4-configoutput-2026-03-31-23_40_21-c5569005-34ad-41e5-b602-f5a2ef89209b.png` — **Infor CPQ Enterprise Quoting API** (verbatim extract → §2)  
- `/Users/yasas.karunarathna/.cursor/projects/Users-yasas-karunarathna-Work-Brompton-sources-brompton-trade/assets/screencapture-developer-infor-api-v4-configoutput-2026-03-31-23_40_21-3-1ca778e2-6de1-42d6-b23f-82ba87ee4692.png` — Product Configurator UI (earlier capture; §1 replaced by `224e7fd2` extract)  
- `/Users/yasas.karunarathna/.cursor/projects/Users-yasas-karunarathna-Work-Brompton-sources-brompton-trade/assets/screencapture-developer-infor-api-v4-configoutput-2026-03-31-23_40_21-043dad66-5fc2-4e77-b77c-28b20f62a392.png` — Enterprise Quoting (earlier capture; §2 replaced by `c5569005` extract)  
- `/Users/yasas.karunarathna/.cursor/projects/Users-yasas-karunarathna-Work-Brompton-sources-brompton-trade/assets/screencapture-developer-infor-api-v4-configoutput-2026-03-31-23_40_21-2-d9e1d11a-d9d5-4447-b263-6134392c15cf.png` — Configurator & Enterprise REST APIs  
