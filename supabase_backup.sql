--
-- PostgreSQL database dump
--

\restrict 57wG27vioxuy89w9D7MQdYj3EMAqqgvFTdSJIKRGpJcc9CDd32wxyUOAQ4WEseU

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: pg_cron; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION pg_cron; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL';


--
-- Name: pgtle; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgtle;


--
-- Name: pg_tle; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_tle WITH SCHEMA pgtle;


--
-- Name: EXTENSION pg_tle; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_tle IS 'Trusted Language Extensions for PostgreSQL';


--
-- Name: supabase-dbdev--0.0.5.sql(); Type: FUNCTION; Schema: pgtle; Owner: -
--

CREATE FUNCTION pgtle."supabase-dbdev--0.0.5.sql"() RETURNS text
    LANGUAGE sql
    AS $_X$SELECT $_pgtle_i_$

create schema dbdev;

-- base_url and api_key have been added as arguments with default values to help test locally
create or replace function dbdev.install(
    package_name text,
    base_url text default 'https://api.database.dev/rest/v1/',
    api_key text default 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdXB0cHBsZnZpaWZyYndtbXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODAxMDczNzIsImV4cCI6MTk5NTY4MzM3Mn0.z2CN0mvO2No8wSi46Gw59DFGCTJrzM0AQKsu_5k134s'
)
    returns bool
    language plpgsql
as $$
declare
    http_ext_schema regnamespace = extnamespace::regnamespace from pg_catalog.pg_extension where extname = 'http' limit 1;
    pgtle_is_available bool = true from pg_catalog.pg_extension where extname = 'pg_tle' limit 1;
    -- HTTP respones
    rec jsonb;
    status int;
    contents json;

    -- Install Record
    rec_sql text;
    rec_ver text;
    rec_from_ver text;
    rec_to_ver text;
    rec_description text;
    rec_requires text[];
    rec_default_ver text;
begin

    if http_ext_schema is null then
        raise exception using errcode='22000', message=format('dbdev requires the http extension and it is not available');
    end if;

    if pgtle_is_available is null then
        raise exception using errcode='22000', message=format('dbdev requires the pgtle extension and it is not available');
    end if;

    -------------------
    -- Base Versions --
    -------------------
    execute  $stmt$select row_to_json(x)
    from $stmt$ || pg_catalog.quote_ident(http_ext_schema::text) || $stmt$.http(
        (
            'GET',
            format(
                '%spackage_versions?select=version,sql,control_description,control_requires&limit=50&or=(package_name.eq.%s,package_alias.eq.%s)',
                $stmt$ || pg_catalog.quote_literal(base_url) || $stmt$,
                $stmt$ || pg_catalog.quote_literal(package_name) || $stmt$,
                $stmt$ || pg_catalog.quote_literal(package_name) || $stmt$
            ),
            array[
                ('apiKey', $stmt$ || pg_catalog.quote_literal(api_key) || $stmt$)::http_header
            ],
            null,
            null
        )
    ) x
    limit 1; $stmt$
    into rec;

    status = (rec ->> 'status')::int;
    contents = to_json(rec ->> 'content') #>> '{}';

    if status <> 200 then
        raise notice using errcode='22000', message=format('DBDEV INFO: %s', contents);
        raise exception using errcode='22000', message=format('Non-200 response code while loading versions from dbdev');
    end if;

    if contents is null or json_typeof(contents) <> 'array' or json_array_length(contents) = 0 then
        raise exception using errcode='22000', message=format('No versions found for package named %s', package_name);
    end if;

    for rec_ver, rec_sql, rec_description, rec_requires in select
            (r ->> 'version'),
            (r ->> 'sql'),
            (r ->> 'control_description'),
            array(select json_array_elements_text((r -> 'control_requires')))
        from
            json_array_elements(contents) as r
        loop

        -- Install the primary version
        if not exists (
            select true
            from pgtle.available_extensions()
            where
                name = package_name
        ) then
            perform pgtle.install_extension(package_name, rec_ver, rec_description, rec_sql, rec_requires);
        end if;

        -- Install other available versions
        if not exists (
            select true
            from pgtle.available_extension_versions()
            where
                name = package_name
                and version = rec_ver
        ) then
            perform pgtle.install_extension_version_sql(package_name, rec_ver, rec_sql);
        end if;

    end loop;

    ----------------------
    -- Upgrade Versions --
    ----------------------
    execute  $stmt$select row_to_json(x)
    from $stmt$ || pg_catalog.quote_ident(http_ext_schema::text) || $stmt$.http(
        (
            'GET',
            format(
                '%spackage_upgrades?select=from_version,to_version,sql&limit=50&or=(package_name.eq.%s,package_alias.eq.%s)',
                $stmt$ || pg_catalog.quote_literal(base_url) || $stmt$,
                $stmt$ || pg_catalog.quote_literal(package_name) || $stmt$,
                $stmt$ || pg_catalog.quote_literal(package_name) || $stmt$
            ),
            array[
                ('apiKey', $stmt$ || pg_catalog.quote_literal(api_key) || $stmt$)::http_header
            ],
            null,
            null
        )
    ) x
    limit 1; $stmt$
    into rec;

    status = (rec ->> 'status')::int;
    contents = to_json(rec ->> 'content') #>> '{}';

    if status <> 200 then
        raise notice using errcode='22000', message=format('DBDEV INFO: %s', contents);
        raise exception using errcode='22000', message=format('Non-200 response code while loading upgrade paths from dbdev');
    end if;

    if json_typeof(contents) <> 'array' then
        raise exception using errcode='22000', message=format('Invalid response from dbdev upgrade paths');
    end if;

    for rec_from_ver, rec_to_ver, rec_sql in select
            (r ->> 'from_version'),
            (r ->> 'to_version'),
            (r ->> 'sql')
        from
            json_array_elements(contents) as r
        loop

        if not exists (
            select true
            from pgtle.extension_update_paths(package_name)
            where
                source = rec_from_ver
                and target = rec_to_ver
                and path is not null
        ) then
            perform pgtle.install_update_path(package_name, rec_from_ver, rec_to_ver, rec_sql);
        end if;
    end loop;

    -------------------------
    -- Set Default Version --
    -------------------------
    execute  $stmt$select row_to_json(x)
    from $stmt$ || pg_catalog.quote_ident(http_ext_schema::text) || $stmt$.http(
        (
            'GET',
            format(
                '%spackages?select=default_version&limit=1&or=(package_name.eq.%s,package_alias.eq.%s)',
                $stmt$ || pg_catalog.quote_literal(base_url) || $stmt$,
                $stmt$ || pg_catalog.quote_literal(package_name) || $stmt$,
                $stmt$ || pg_catalog.quote_literal(package_name) || $stmt$
            ),
            array[
                ('apiKey', $stmt$ || pg_catalog.quote_literal(api_key) || $stmt$)::http_header
            ],
            null,
            null
        )
    ) x
    limit 1; $stmt$
    into rec;

    status = (rec ->> 'status')::int;
    contents = to_json(rec ->> 'content') #>> '{}';

    if status <> 200 then
        raise notice using errcode='22000', message=format('DBDEV INFO: %s', contents);
        raise exception using errcode='22000', message=format('Non-200 response code while loading packages from dbdev');
    end if;

    if contents is null or json_typeof(contents) <> 'array' or json_array_length(contents) = 0 then
        raise exception using errcode='22000', message=format('No package named %s found', package_name);
    end if;

    for rec_default_ver in select
            (r ->> 'default_version')
        from
            json_array_elements(contents) as r
        loop

        if rec_default_ver is not null then
            perform pgtle.set_default_version(package_name, rec_default_ver);
        else
            raise notice using errcode='22000', message=format('DBDEV INFO: missing default version');
        end if;

    end loop;

    --------------------------
    -- Send Download Notice --
    --------------------------
    -- Notifies dbdev that a package has been downloaded and records IP + user agent so we can compute unique download counts
    execute  $stmt$select row_to_json(x)
    from $stmt$ || pg_catalog.quote_ident(http_ext_schema::text) || $stmt$.http(
        (
            'POST',
            format(
                '%srpc/register_download',
                $stmt$ || pg_catalog.quote_literal(base_url) || $stmt$
            ),
            array[
                ('apiKey', $stmt$ || pg_catalog.quote_literal(api_key) || $stmt$)::http_header,
                ('x-client-info', 'dbdev/0.0.5')::http_header
            ],
            'application/json',
            json_build_object('package_name', $stmt$ || pg_catalog.quote_literal(package_name) || $stmt$)::text
        )
    ) x
    limit 1; $stmt$
    into rec;

    return true;
end;
$$;

$_pgtle_i_$$_X$;


--
-- Name: supabase-dbdev; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "supabase-dbdev" WITH SCHEMA public;


--
-- Name: EXTENSION "supabase-dbdev"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "supabase-dbdev" IS 'PostgreSQL package manager';


--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;


--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_migrations;


--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;


--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
begin
    raise debug 'PgBouncer auth request: %', p_usename;

    return query
    select 
        rolname::text, 
        case when rolvaliduntil < now() 
            then null 
            else rolpassword::text 
        end 
    from pg_authid 
    where rolname=$1 and rolcanlogin;
end;
$_$;


--
-- Name: supabase-dbdev--0.0.2.sql(); Type: FUNCTION; Schema: pgtle; Owner: -
--

CREATE FUNCTION pgtle."supabase-dbdev--0.0.2.sql"() RETURNS text
    LANGUAGE sql
    AS $_X$SELECT $_pgtle_i_$

create schema dbdev;

create or replace function dbdev.install(package_name text)
    returns bool
    language plpgsql
as $$
declare
    -- Endpoint
    base_url text = 'https://api.database.dev/rest/v1/';
    apikey text = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdXB0cHBsZnZpaWZyYndtbXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODAxMDczNzIsImV4cCI6MTk5NTY4MzM3Mn0.z2CN0mvO2No8wSi46Gw59DFGCTJrzM0AQKsu_5k134s';

    http_ext_schema regnamespace = extnamespace::regnamespace from pg_catalog.pg_extension where extname = 'http' limit 1;
    pgtle_is_available bool = true from pg_catalog.pg_extension where extname = 'pg_tle' limit 1;
    -- HTTP respones
    rec jsonb;
    status int;
    contents json;

    -- Install Record
    rec_sql text;
    rec_ver text;
    rec_from_ver text;
    rec_to_ver text;
    rec_package_name text;
    rec_description text;
    rec_requires text[];
begin

    if http_ext_schema is null then
        raise exception using errcode='22000', message=format('dbdev requires the http extension and it is not available');
    end if;

    if pgtle_is_available is null then
        raise exception using errcode='22000', message=format('dbdev requires the pgtle extension and it is not available');
    end if;

    -------------------
    -- Base Versions --
    -------------------
    execute  $stmt$select row_to_json(x)
    from $stmt$ || pg_catalog.quote_ident(http_ext_schema::text) || $stmt$.http(
        (
            'GET',
            format(
                '%spackage_versions?select=package_name,version,sql,control_description,control_requires&limit=50&package_name=eq.%s',
                $stmt$ || pg_catalog.quote_literal(base_url) || $stmt$,
                $stmt$ || pg_catalog.quote_literal($1) || $stmt$
            ),
            array[
                ('apiKey', $stmt$ || pg_catalog.quote_literal(apikey) || $stmt$)::http_header
            ],
            null,
            null
        )
    ) x
    limit 1; $stmt$
    into rec;

    status = (rec ->> 'status')::int;
    contents = to_json(rec ->> 'content') #>> '{}';

    if status <> 200 then
        raise notice using errcode='22000', message=format('DBDEV INFO: %s', contents);
        raise exception using errcode='22000', message=format('Non-200 response code while loading versions from dbdev');
    end if;

    if contents is null or json_typeof(contents) <> 'array' or json_array_length(contents) = 0 then
        raise exception using errcode='22000', message=format('No versions for package named named %s', package_name);
    end if;

    for rec_package_name, rec_ver, rec_sql, rec_description, rec_requires in select
            (r ->> 'package_name'),
            (r ->> 'version'),
            (r ->> 'sql'),
            (r ->> 'control_description'),
            to_json(rec ->> 'control_requires') #>> '{}'
        from
            json_array_elements(contents) as r
        loop

        if not exists (
            select true
            from pgtle.available_extension_versions()
            where
                -- TLE will not allow multiple full install scripts
                -- TODO(OR) open upstream issue to discuss
                name = rec_package_name
        ) then
            perform pgtle.install_extension(rec_package_name, rec_ver, rec_package_name, rec_sql);
        end if;
    end loop;

    ----------------------
    -- Upgrade Versions --
    ----------------------
    execute  $stmt$select row_to_json(x)
    from $stmt$ || pg_catalog.quote_ident(http_ext_schema::text) || $stmt$.http(
        (
            'GET',
            format(
                '%spackage_upgrades?select=package_name,from_version,to_version,sql&limit=50&package_name=eq.%s',
                $stmt$ || pg_catalog.quote_literal(base_url) || $stmt$,
                $stmt$ || pg_catalog.quote_literal($1) || $stmt$
            ),
            array[
                ('apiKey', $stmt$ || pg_catalog.quote_literal(apikey) || $stmt$)::http_header
            ],
            null,
            null
        )
    ) x
    limit 1; $stmt$
    into rec;

    status = (rec ->> 'status')::int;
    contents = to_json(rec ->> 'content') #>> '{}';

    if status <> 200 then
        raise notice using errcode='22000', message=format('DBDEV INFO: %s', contents);
        raise exception using errcode='22000', message=format('Non-200 response code while loading upgrade pathes from dbdev');
    end if;

    if json_typeof(contents) <> 'array' then
        raise exception using errcode='22000', message=format('Invalid response from dbdev upgrade pathes');
    end if;

    for rec_package_name, rec_from_ver, rec_to_ver, rec_sql in select
            (r ->> 'package_name'),
            (r ->> 'from_version'),
            (r ->> 'to_version'),
            (r ->> 'sql')
        from
            json_array_elements(contents) as r
        loop

        if not exists (
            select true
            from pgtle.extension_update_paths(rec_package_name)
            where
                source = rec_from_ver
                and target = rec_to_ver
                and path is not null
        ) then
            perform pgtle.install_update_path(rec_package_name, rec_from_ver, rec_to_ver, rec_sql);
        end if;
    end loop;

    --------------------------
    -- Send Download Notice --
    --------------------------
    -- Notifies dbdev that a package has been downloaded and records IP + user agent so we can compute unique download counts
    execute  $stmt$select row_to_json(x)
    from $stmt$ || pg_catalog.quote_ident(http_ext_schema::text) || $stmt$.http(
        (
            'POST',
            format(
                '%srpc/register_download',
                $stmt$ || pg_catalog.quote_literal(base_url) || $stmt$
            ),
            array[
                ('apiKey', $stmt$ || pg_catalog.quote_literal(apikey) || $stmt$)::http_header,
                ('x-client-info', 'dbdev/0.0.2')::http_header
            ],
            'application/json',
            json_build_object('package_name', $stmt$ || pg_catalog.quote_literal($1) || $stmt$)::text
        )
    ) x
    limit 1; $stmt$
    into rec;

    return true;
end;
$$;

$_pgtle_i_$$_X$;


--
-- Name: supabase-dbdev--0.0.3.sql(); Type: FUNCTION; Schema: pgtle; Owner: -
--

CREATE FUNCTION pgtle."supabase-dbdev--0.0.3.sql"() RETURNS text
    LANGUAGE sql
    AS $_X$SELECT $_pgtle_i_$

create schema dbdev;

create or replace function dbdev.install(package_name text)
    returns bool
    language plpgsql
as $$
declare
    -- Endpoint
    base_url text = 'https://api.database.dev/rest/v1/';
    apikey text = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdXB0cHBsZnZpaWZyYndtbXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODAxMDczNzIsImV4cCI6MTk5NTY4MzM3Mn0.z2CN0mvO2No8wSi46Gw59DFGCTJrzM0AQKsu_5k134s';

    http_ext_schema regnamespace = extnamespace::regnamespace from pg_catalog.pg_extension where extname = 'http' limit 1;
    pgtle_is_available bool = true from pg_catalog.pg_extension where extname = 'pg_tle' limit 1;
    -- HTTP respones
    rec jsonb;
    status int;
    contents json;

    -- Install Record
    rec_sql text;
    rec_ver text;
    rec_from_ver text;
    rec_to_ver text;
    rec_package_name text;
    rec_description text;
    rec_requires text[];
begin

    if http_ext_schema is null then
        raise exception using errcode='22000', message=format('dbdev requires the http extension and it is not available');
    end if;

    if pgtle_is_available is null then
        raise exception using errcode='22000', message=format('dbdev requires the pgtle extension and it is not available');
    end if;

    -------------------
    -- Base Versions --
    -------------------
    execute  $stmt$select row_to_json(x)
    from $stmt$ || pg_catalog.quote_ident(http_ext_schema::text) || $stmt$.http(
        (
            'GET',
            format(
                '%spackage_versions?select=package_name,version,sql,control_description,control_requires&limit=50&package_name=eq.%s',
                $stmt$ || pg_catalog.quote_literal(base_url) || $stmt$,
                $stmt$ || pg_catalog.quote_literal($1) || $stmt$
            ),
            array[
                ('apiKey', $stmt$ || pg_catalog.quote_literal(apikey) || $stmt$)::http_header
            ],
            null,
            null
        )
    ) x
    limit 1; $stmt$
    into rec;

    status = (rec ->> 'status')::int;
    contents = to_json(rec ->> 'content') #>> '{}';

    if status <> 200 then
        raise notice using errcode='22000', message=format('DBDEV INFO: %s', contents);
        raise exception using errcode='22000', message=format('Non-200 response code while loading versions from dbdev');
    end if;

    if contents is null or json_typeof(contents) <> 'array' or json_array_length(contents) = 0 then
        raise exception using errcode='22000', message=format('No versions for package named named %s', package_name);
    end if;

    for rec_package_name, rec_ver, rec_sql, rec_description, rec_requires in select
            (r ->> 'package_name'),
            (r ->> 'version'),
            (r ->> 'sql'),
            (r ->> 'control_description'),
            array(select json_array_elements_text((r -> 'control_requires')))
        from
            json_array_elements(contents) as r
        loop

        -- Install the primary version
        if not exists (
            select true
            from pgtle.available_extensions()
            where
                name = rec_package_name
        ) then
            perform pgtle.install_extension(rec_package_name, rec_ver, rec_package_name, rec_sql, rec_requires);
        end if;

        -- Install other available versions
        if not exists (
            select true
            from pgtle.available_extension_versions()
            where
                name = rec_package_name
                and version = rec_ver
        ) then
            perform pgtle.install_extension_version_sql(rec_package_name, rec_ver, rec_sql);
        end if;

    end loop;

    ----------------------
    -- Upgrade Versions --
    ----------------------
    execute  $stmt$select row_to_json(x)
    from $stmt$ || pg_catalog.quote_ident(http_ext_schema::text) || $stmt$.http(
        (
            'GET',
            format(
                '%spackage_upgrades?select=package_name,from_version,to_version,sql&limit=50&package_name=eq.%s',
                $stmt$ || pg_catalog.quote_literal(base_url) || $stmt$,
                $stmt$ || pg_catalog.quote_literal($1) || $stmt$
            ),
            array[
                ('apiKey', $stmt$ || pg_catalog.quote_literal(apikey) || $stmt$)::http_header
            ],
            null,
            null
        )
    ) x
    limit 1; $stmt$
    into rec;

    status = (rec ->> 'status')::int;
    contents = to_json(rec ->> 'content') #>> '{}';

    if status <> 200 then
        raise notice using errcode='22000', message=format('DBDEV INFO: %s', contents);
        raise exception using errcode='22000', message=format('Non-200 response code while loading upgrade pathes from dbdev');
    end if;

    if json_typeof(contents) <> 'array' then
        raise exception using errcode='22000', message=format('Invalid response from dbdev upgrade pathes');
    end if;

    for rec_package_name, rec_from_ver, rec_to_ver, rec_sql in select
            (r ->> 'package_name'),
            (r ->> 'from_version'),
            (r ->> 'to_version'),
            (r ->> 'sql')
        from
            json_array_elements(contents) as r
        loop

        if not exists (
            select true
            from pgtle.extension_update_paths(rec_package_name)
            where
                source = rec_from_ver
                and target = rec_to_ver
                and path is not null
        ) then
            perform pgtle.install_update_path(rec_package_name, rec_from_ver, rec_to_ver, rec_sql);
        end if;
    end loop;

    --------------------------
    -- Send Download Notice --
    --------------------------
    -- Notifies dbdev that a package has been downloaded and records IP + user agent so we can compute unique download counts
    execute  $stmt$select row_to_json(x)
    from $stmt$ || pg_catalog.quote_ident(http_ext_schema::text) || $stmt$.http(
        (
            'POST',
            format(
                '%srpc/register_download',
                $stmt$ || pg_catalog.quote_literal(base_url) || $stmt$
            ),
            array[
                ('apiKey', $stmt$ || pg_catalog.quote_literal(apikey) || $stmt$)::http_header,
                ('x-client-info', 'dbdev/0.0.2')::http_header
            ],
            'application/json',
            json_build_object('package_name', $stmt$ || pg_catalog.quote_literal($1) || $stmt$)::text
        )
    ) x
    limit 1; $stmt$
    into rec;

    return true;
end;
$$;

$_pgtle_i_$$_X$;


--
-- Name: supabase-dbdev--0.0.4.sql(); Type: FUNCTION; Schema: pgtle; Owner: -
--

CREATE FUNCTION pgtle."supabase-dbdev--0.0.4.sql"() RETURNS text
    LANGUAGE sql
    AS $_X$SELECT $_pgtle_i_$

create schema dbdev;

-- base_url and api_key have been added as arguments with default values to help test locally
create or replace function dbdev.install(
    package_name text,
    base_url text default 'https://api.database.dev/rest/v1/',
    api_key text default 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdXB0cHBsZnZpaWZyYndtbXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODAxMDczNzIsImV4cCI6MTk5NTY4MzM3Mn0.z2CN0mvO2No8wSi46Gw59DFGCTJrzM0AQKsu_5k134s'
)
    returns bool
    language plpgsql
as $$
declare
    http_ext_schema regnamespace = extnamespace::regnamespace from pg_catalog.pg_extension where extname = 'http' limit 1;
    pgtle_is_available bool = true from pg_catalog.pg_extension where extname = 'pg_tle' limit 1;
    -- HTTP respones
    rec jsonb;
    status int;
    contents json;

    -- Install Record
    rec_sql text;
    rec_ver text;
    rec_from_ver text;
    rec_to_ver text;
    rec_package_name text;
    rec_description text;
    rec_requires text[];
    rec_default_ver text;
begin

    if http_ext_schema is null then
        raise exception using errcode='22000', message=format('dbdev requires the http extension and it is not available');
    end if;

    if pgtle_is_available is null then
        raise exception using errcode='22000', message=format('dbdev requires the pgtle extension and it is not available');
    end if;

    -------------------
    -- Base Versions --
    -------------------
    execute  $stmt$select row_to_json(x)
    from $stmt$ || pg_catalog.quote_ident(http_ext_schema::text) || $stmt$.http(
        (
            'GET',
            format(
                '%spackage_versions?select=package_name,version,sql,control_description,control_requires&limit=50&package_name=eq.%s',
                $stmt$ || pg_catalog.quote_literal(base_url) || $stmt$,
                $stmt$ || pg_catalog.quote_literal($1) || $stmt$
            ),
            array[
                ('apiKey', $stmt$ || pg_catalog.quote_literal(api_key) || $stmt$)::http_header
            ],
            null,
            null
        )
    ) x
    limit 1; $stmt$
    into rec;

    status = (rec ->> 'status')::int;
    contents = to_json(rec ->> 'content') #>> '{}';

    if status <> 200 then
        raise notice using errcode='22000', message=format('DBDEV INFO: %s', contents);
        raise exception using errcode='22000', message=format('Non-200 response code while loading versions from dbdev');
    end if;

    if contents is null or json_typeof(contents) <> 'array' or json_array_length(contents) = 0 then
        raise exception using errcode='22000', message=format('No versions found for package named %s', package_name);
    end if;

    for rec_package_name, rec_ver, rec_sql, rec_description, rec_requires in select
            (r ->> 'package_name'),
            (r ->> 'version'),
            (r ->> 'sql'),
            (r ->> 'control_description'),
            array(select json_array_elements_text((r -> 'control_requires')))
        from
            json_array_elements(contents) as r
        loop

        -- Install the primary version
        if not exists (
            select true
            from pgtle.available_extensions()
            where
                name = rec_package_name
        ) then
            perform pgtle.install_extension(rec_package_name, rec_ver, rec_description, rec_sql, rec_requires);
        end if;

        -- Install other available versions
        if not exists (
            select true
            from pgtle.available_extension_versions()
            where
                name = rec_package_name
                and version = rec_ver
        ) then
            perform pgtle.install_extension_version_sql(rec_package_name, rec_ver, rec_sql);
        end if;

    end loop;

    ----------------------
    -- Upgrade Versions --
    ----------------------
    execute  $stmt$select row_to_json(x)
    from $stmt$ || pg_catalog.quote_ident(http_ext_schema::text) || $stmt$.http(
        (
            'GET',
            format(
                '%spackage_upgrades?select=package_name,from_version,to_version,sql&limit=50&package_name=eq.%s',
                $stmt$ || pg_catalog.quote_literal(base_url) || $stmt$,
                $stmt$ || pg_catalog.quote_literal($1) || $stmt$
            ),
            array[
                ('apiKey', $stmt$ || pg_catalog.quote_literal(api_key) || $stmt$)::http_header
            ],
            null,
            null
        )
    ) x
    limit 1; $stmt$
    into rec;

    status = (rec ->> 'status')::int;
    contents = to_json(rec ->> 'content') #>> '{}';

    if status <> 200 then
        raise notice using errcode='22000', message=format('DBDEV INFO: %s', contents);
        raise exception using errcode='22000', message=format('Non-200 response code while loading upgrade paths from dbdev');
    end if;

    if json_typeof(contents) <> 'array' then
        raise exception using errcode='22000', message=format('Invalid response from dbdev upgrade paths');
    end if;

    for rec_package_name, rec_from_ver, rec_to_ver, rec_sql in select
            (r ->> 'package_name'),
            (r ->> 'from_version'),
            (r ->> 'to_version'),
            (r ->> 'sql')
        from
            json_array_elements(contents) as r
        loop

        if not exists (
            select true
            from pgtle.extension_update_paths(rec_package_name)
            where
                source = rec_from_ver
                and target = rec_to_ver
                and path is not null
        ) then
            perform pgtle.install_update_path(rec_package_name, rec_from_ver, rec_to_ver, rec_sql);
        end if;
    end loop;

    -------------------------
    -- Set Default Version --
    -------------------------
    execute  $stmt$select row_to_json(x)
    from $stmt$ || pg_catalog.quote_ident(http_ext_schema::text) || $stmt$.http(
        (
            'GET',
            format(
                '%spackages?select=package_name,default_version&limit=1&package_name=eq.%s',
                $stmt$ || pg_catalog.quote_literal(base_url) || $stmt$,
                $stmt$ || pg_catalog.quote_literal($1) || $stmt$
            ),
            array[
                ('apiKey', $stmt$ || pg_catalog.quote_literal(api_key) || $stmt$)::http_header
            ],
            null,
            null
        )
    ) x
    limit 1; $stmt$
    into rec;

    status = (rec ->> 'status')::int;
    contents = to_json(rec ->> 'content') #>> '{}';

    if status <> 200 then
        raise notice using errcode='22000', message=format('DBDEV INFO: %s', contents);
        raise exception using errcode='22000', message=format('Non-200 response code while loading packages from dbdev');
    end if;

    if contents is null or json_typeof(contents) <> 'array' or json_array_length(contents) = 0 then
        raise exception using errcode='22000', message=format('No package named %s found', package_name);
    end if;

    for rec_package_name, rec_default_ver in select
            (r ->> 'package_name'),
            (r ->> 'default_version')
        from
            json_array_elements(contents) as r
        loop

        if rec_default_ver is not null then
            perform pgtle.set_default_version(rec_package_name, rec_default_ver);
        else
            raise notice using errcode='22000', message=format('DBDEV INFO: missing default version');
        end if;

    end loop;

    --------------------------
    -- Send Download Notice --
    --------------------------
    -- Notifies dbdev that a package has been downloaded and records IP + user agent so we can compute unique download counts
    execute  $stmt$select row_to_json(x)
    from $stmt$ || pg_catalog.quote_ident(http_ext_schema::text) || $stmt$.http(
        (
            'POST',
            format(
                '%srpc/register_download',
                $stmt$ || pg_catalog.quote_literal(base_url) || $stmt$
            ),
            array[
                ('apiKey', $stmt$ || pg_catalog.quote_literal(api_key) || $stmt$)::http_header,
                ('x-client-info', 'dbdev/0.0.4')::http_header
            ],
            'application/json',
            json_build_object('package_name', $stmt$ || pg_catalog.quote_literal($1) || $stmt$)::text
        )
    ) x
    limit 1; $stmt$
    into rec;

    return true;
end;
$$;

$_pgtle_i_$$_X$;


--
-- Name: supabase-dbdev.control(); Type: FUNCTION; Schema: pgtle; Owner: -
--

CREATE FUNCTION pgtle."supabase-dbdev.control"() RETURNS text
    LANGUAGE sql
    AS $_X$SELECT $_pgtle_i_$default_version = '0.0.5'
comment = 'PostgreSQL package manager'
relocatable = false
superuser = false
trusted = false
requires = 'pg_tle'
$_pgtle_i_$$_X$;


--
-- Name: _tx_is_credit(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._tx_is_credit(t text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  select lower(coalesce(t,'')) in ('credit','reward','bonus','referral','daily_login','quiz_reward', 'refund')
$$;


--
-- Name: add_credit(uuid, text, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_credit(p_user_id uuid, p_type text, p_amount integer, p_desc text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.transactions(user_id, type, amount, description, created_at)
  VALUES (p_user_id, p_type, p_amount, p_desc, now());
END;
$$;


--
-- Name: after_daily_streak_credit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_daily_streak_credit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  has_credit boolean;
  v_desc text;
begin
  if TG_OP <> 'INSERT' then
    return NEW;
  end if;

  select exists (
    select 1 from public.transactions t
    where t.user_id = NEW.user_id
      and t.type = 'daily_login'
      and t.created_at::date = current_date
  ) into has_credit;

  if not has_credit then
    v_desc := 'Daily login streak day ' || coalesce(NEW.streak_day, 1);
    begin
      perform public.add_credit(NEW.user_id, 'daily_login', coalesce(NEW.coins_earned, 10), v_desc);
    exception when unique_violation then
      -- Another concurrent flow credited first; ignore
      null;
    end;
  end if;

  return NEW;
end;
$$;


--
-- Name: after_quiz_result_check(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_quiz_result_check() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
    perform check_quiz_champion(new.user_id);
    return new;
end;
$$;


--
-- Name: after_referral_check(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_referral_check() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
    perform check_referral_king(new.referrer_id);
    return new;
end;
$$;


--
-- Name: approve_latest_redemption(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_latest_redemption(p_email text, p_reward_value text) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
    r_id uuid;
begin
    select r.id into r_id
    from public.redemptions r
    join public.profiles p on p.id = r.user_id
    where p.email = p_email
      and r.reward_value = p_reward_value
      and r.status = 'pending'
    order by r.requested_at desc
    limit 1;

    if not found then
        return 'No pending redemption found';
    end if;

    return approve_redemption(r_id);
end;
$$;


--
-- Name: approve_redemption(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_redemption(p_redemption_id uuid) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
    update public.redemptions
    set status = 'completed',
        processed_at = now()
    where id = p_redemption_id
      and status = 'pending';

    if not found then
        return 'Invalid or Already Processed';
    end if;

    return 'Redemption Approved';
end;
$$;


--
-- Name: assign_level(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_level() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
    update profiles
    set level = (
        select l.name
        from levels l
        where new.total_coins >= l.min_coins
          and (l.max_coins is null or new.total_coins <= l.max_coins)
        limit 1
    )
    where id = new.id;
    return new;
end;
$$;


--
-- Name: compute_quiz_results(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_quiz_results(p_quiz_id uuid) RETURNS TABLE(result_id uuid, result_quiz_id uuid, leaderboard jsonb, created_at timestamp with time zone, result_shown_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_leaderboard jsonb := '[]'::jsonb;
begin
  if p_quiz_id is null then
    raise exception 'compute_quiz_results: quiz_id is null. Provide a valid quiz id.';
  end if;

  with
  qns(question_id) as (
    select q.id as question_id
    from public.questions q
    where q.quiz_id = p_quiz_id
  ),
  counts as (
    select ua.question_id, ua.selected_option_id, count(*) as cnt
    from public.user_answers ua
    join qns on qns.question_id = ua.question_id
    join public.quiz_participants qp
      on qp.user_id = ua.user_id and qp.quiz_id = p_quiz_id
    group by ua.question_id, ua.selected_option_id
  ),
  majority as (
    select c.question_id,
           (array_agg(c.selected_option_id order by c.cnt desc, c.selected_option_id asc))[1] as majority_option_id,
           max(c.cnt) as max_cnt
    from counts c
    group by c.question_id
  ),
  correct_answers as (
    select ua.user_id, ua.question_id, ua.answered_at
    from public.user_answers ua
    join majority m
      on m.question_id = ua.question_id
     and m.majority_option_id = ua.selected_option_id
  ),
  scores as (
    select qp.user_id,
           coalesce(count(ca.question_id), 0) as score,
           min(ca.answered_at) as tie_break_time
    from public.quiz_participants qp
    left join correct_answers ca on ca.user_id = qp.user_id
    where qp.quiz_id = p_quiz_id
    group by qp.user_id
  ),
  ranked as (
    select qp.user_id,
           s.score,
           coalesce(s.tie_break_time, 'infinity'::timestamptz) as tie_break_time,
           qp.joined_at,
           dense_rank() over (
             order by s.score desc,
                      coalesce(s.tie_break_time, 'infinity'::timestamptz) asc,
                      qp.joined_at asc
           ) as rnk
    from public.quiz_participants qp
    join scores s on s.user_id = qp.user_id
    where qp.quiz_id = p_quiz_id
  )
  select coalesce(
           (
             select jsonb_agg(
               jsonb_build_object(
                 'user_id', r.user_id,
                 'display_name', coalesce(p.full_name, split_part(coalesce(p.email,''),'@',1), 'Player'),
                 'score', r.score,
                 'rank', r.rnk
               )
               order by r.rnk asc
             )
             from ranked r
             join public.profiles p on p.id = r.user_id
           ),
           '[]'::jsonb
         )
    into v_leaderboard;

  insert into public.quiz_results (quiz_id, leaderboard)
  values (p_quiz_id, v_leaderboard)
  on conflict (quiz_id)
  do update set leaderboard = excluded.leaderboard,
               created_at = now(),
               result_shown_at = now();

  update public.quizzes
     set status = 'completed',
         result_time = coalesce(result_time, now())
   where id = p_quiz_id
     and status in ('active','finished','upcoming');

  return query
    select qr.id as result_id,
           qr.quiz_id as result_quiz_id,
           qr.leaderboard,
           qr.created_at,
           qr.result_shown_at
    from public.quiz_results qr
    where qr.quiz_id = p_quiz_id;
end;
$$;


--
-- Name: create_notification(text, text, text, uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_notification(p_title text, p_message text, p_type text, p_quiz_id uuid, p_scheduled_at timestamp with time zone) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  nid uuid;
BEGIN
  INSERT INTO public.notifications (title, message, type, quiz_id, scheduled_at, created_by)
  VALUES (p_title, p_message, p_type, p_quiz_id, p_scheduled_at, auth.uid())
  RETURNING id INTO nid;

  RETURN nid;
END;
$$;


--
-- Name: delete_push_subscription(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_push_subscription(p_endpoint text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    DELETE FROM public.push_subscriptions
    WHERE user_id = auth.uid() AND (subscription_object->>'endpoint') = p_endpoint;
END;
$$;


--
-- Name: FUNCTION delete_push_subscription(p_endpoint text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.delete_push_subscription(p_endpoint text) IS 'Deletes a specific web push subscription for the current user.';


--
-- Name: generate_referral_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_referral_code() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    IF NEW.referral_code IS NULL THEN
        NEW.referral_code := UPPER(SUBSTRING(REPLACE(NEW.id::TEXT, '-', ''), 1, 8));
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: get_all_time_leaderboard(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_time_leaderboard(limit_rows integer DEFAULT 100, offset_rows integer DEFAULT 0) RETURNS TABLE(user_id uuid, full_name text, avatar_url text, level text, current_streak integer, max_streak integer, referrals integer, coins_earned numeric, rank bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with base as (
    select
      p.id as user_id,
      coalesce(p.full_name, split_part(coalesce(p.email,''),'@',1), 'Player') as full_name,
      p.avatar_url,
      p.level,
      coalesce(p.current_streak,0) as current_streak,
      coalesce(p.max_streak,0) as max_streak,
      coalesce((select count(*) from public.referrals r where r.referrer_id = p.id), 0)::int as referrals,
      coalesce(p.total_earned,0) as coins_earned
    from public.profiles p
  ), ranked as (
    select *, dense_rank() over (order by coins_earned desc, max_streak desc, full_name asc) as rank
    from base
  )
  select
    user_id,
    full_name,
    avatar_url,
    level,
    current_streak,
    max_streak,
    referrals,
    coins_earned,
    rank
  from ranked
  order by rank, full_name
  limit limit_rows
  offset offset_rows
$$;


--
-- Name: get_leaderboard(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_leaderboard(p_period text, limit_rows integer DEFAULT 100, offset_rows integer DEFAULT 0) RETURNS TABLE(user_id uuid, username text, full_name text, avatar_url text, leaderboard_score numeric, win_rate numeric, streak integer, rank bigint)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
WITH time_window AS (
    SELECT
        CASE
            WHEN p_period = 'weekly' THEN date_trunc('week', now())
            WHEN p_period = 'monthly' THEN date_trunc('month', now())
            ELSE '1970-01-01'::timestamptz
        END as start_date
),
quiz_stats AS (
    SELECT
        s.user_id,
        SUM(s.correct_answers) as total_correct_answers,
        SUM(s.attempted_questions) as total_attempted_questions
    FROM public.user_quiz_stats s, time_window
    WHERE s.completed_at >= time_window.start_date
    GROUP BY s.user_id
),
streak_stats AS (
    SELECT
        s.user_id,
        COUNT(*)::int as streak
    FROM public.daily_streaks s, time_window
    WHERE s.login_date >= time_window.start_date::date
    GROUP BY s.user_id
),
ranked_users AS (
    SELECT
        p.id as user_id,
        p.username,
        p.full_name,
        p.avatar_url,
        -- Calculate Win Rate and Points
        CASE
            WHEN COALESCE(qs.total_attempted_questions, 0) = 0 THEN 0
            ELSE (qs.total_correct_answers::numeric / qs.total_attempted_questions) * 100
        END as win_rate,
        LEAST(
            (
                CASE
                    WHEN COALESCE(qs.total_attempted_questions, 0) = 0 THEN 0
                    ELSE (qs.total_correct_answers::numeric / qs.total_attempted_questions) * 100
                END
            ) * 0.7, 70
        ) as win_rate_points,
        -- Calculate Streak Points
        LEAST(
            COALESCE(ss.streak, 0) * 1, 30
        ) as streak_points,
        COALESCE(ss.streak, 0) as streak
    FROM public.profiles p
    LEFT JOIN quiz_stats qs ON p.id = qs.user_id
    LEFT JOIN streak_stats ss ON p.id = ss.user_id
    WHERE p.is_profile_complete = true
),
final_scores AS (
    SELECT
        *,
        LEAST(win_rate_points + streak_points, 100) as leaderboard_score
    FROM ranked_users
)
SELECT
    s.user_id,
    s.username,
    s.full_name,
    s.avatar_url,
    s.leaderboard_score,
    s.win_rate,
    s.streak,
    DENSE_RANK() OVER (ORDER BY s.leaderboard_score DESC, s.streak DESC, s.user_id ASC) as rank
FROM final_scores s
ORDER BY rank ASC
LIMIT limit_rows
OFFSET offset_rows;
$$;


--
-- Name: get_my_claim(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_claim(claim text) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb -> claim
$$;


--
-- Name: get_participant_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_participant_count(p_quiz_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select count(*)::int
  from public.quiz_participants
  where quiz_id = p_quiz_id;
$$;


--
-- Name: handle_daily_login(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_daily_login(user_uuid uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  today date := current_date;
  yesterday date := current_date - interval '1 day';
  p profiles%rowtype;
  s_day int;
  s_coins int;
  existing record;
  v_rowcount int := 0;
begin
  if user_uuid is null then
    return json_build_object('error','missing user id');
  end if;

  select * into p from public.profiles where id = user_uuid;
  if not found then
    return json_build_object('error','User not found');
  end if;

  -- If already logged today, return current state
  select ds.streak_day, ds.coins_earned
  into existing
  from public.daily_streaks ds
  where ds.user_id = user_uuid and ds.login_date = today;

  if found then
    return json_build_object(
      'already_logged', true,
      'streak_day', existing.streak_day,
      'coins_earned', existing.coins_earned
    );
  end if;

  -- Compute next streak + coins
  s_day := case when p.last_login_date = yesterday then coalesce(p.current_streak,0) + 1 else 1 end;
  s_coins := least(50, 10 + (s_day - 1) * 5);

  -- Insert streak row once (trigger will credit wallet)
  begin
    insert into public.daily_streaks (user_id, login_date, coins_earned, streak_day)
    values (user_uuid, today, s_coins, s_day)
    on conflict (user_id, login_date) do nothing;
    get diagnostics v_rowcount = ROW_COUNT;
  exception when others then
    v_rowcount := 0;
  end;

  if v_rowcount = 0 then
    -- Concurrency: someone inserted first
    select ds.streak_day, ds.coins_earned
    into existing
    from public.daily_streaks ds
    where ds.user_id = user_uuid and ds.login_date = today;

    return json_build_object(
      'already_logged', true,
      'streak_day', coalesce(existing.streak_day, s_day),
      'coins_earned', coalesce(existing.coins_earned, s_coins)
    );
  end if;

  -- Update only streak metadata on profile
  update public.profiles
  set
    current_streak = s_day,
    max_streak = greatest(coalesce(max_streak,0), s_day),
    last_login_date = today
  where id = user_uuid;

  return json_build_object(
    'success', true,
    'is_new_login', true,
    'streak_day', s_day,
    'coins_earned', s_coins
  );
end;
$$;


--
-- Name: handle_referral_bonus(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_referral_bonus(referred_user_uuid uuid, referrer_code text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  referrer_record record;
  exists_referral boolean := false;
begin
  select * into referrer_record
  from public.profiles
  where referral_code = referrer_code
    and id != referred_user_uuid;

  if not found then
    return json_build_object('error','Invalid referral code');
  end if;

  select exists(
    select 1 from public.referrals
    where referrer_id = referrer_record.id
      and referred_id = referred_user_uuid
  ) into exists_referral;

  if exists_referral then
    return json_build_object('error','Referral already processed');
  end if;

  insert into public.referrals (referrer_id, referred_id, referral_code, coins_awarded)
  values (referrer_record.id, referred_user_uuid, referrer_code, 50);

  insert into public.transactions (user_id, type, amount, description, reference_id)
  values (referrer_record.id, 'referral', 50, 'Referral bonus', referred_user_uuid);

  update public.profiles
  set referred_by = referrer_record.id
  where id = referred_user_uuid;

  return json_build_object(
    'success', true,
    'referrer_username', referrer_record.username,
    'coins_awarded', 50
  );
end;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select coalesce((select public.jwt_claim('is_admin')) = 'true', false);
$$;


--
-- Name: is_own_profile(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_own_profile(p_profile_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT auth.uid() = p_profile_id;
$$;


--
-- Name: is_quiz_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_quiz_member(p_quiz_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.quiz_participants
    WHERE quiz_id = p_quiz_id AND user_id = auth.uid()
  );
$$;


--
-- Name: join_quiz(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_quiz(p_quiz_id uuid) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
    quiz_entry_fee int;
    user_balance int;
    v_user_id uuid := auth.uid();
begin
    select entry_fee into quiz_entry_fee from public.quizzes where id = p_quiz_id;
    select wallet_balance into user_balance from public.profiles where id = v_user_id;

    if user_balance < quiz_entry_fee then
        return 'Insufficient Balance';
    end if;

    insert into public.transactions (user_id, type, amount, status, description)
    values (v_user_id, 'debit', quiz_entry_fee, 'success', 'Quiz entry fee');

    insert into public.quiz_participants (user_id, quiz_id, status)
    values (v_user_id, p_quiz_id, 'joined');

    return 'Joined Successfully';
end;
$$;


--
-- Name: join_quiz(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_quiz(p_user_id uuid, p_quiz_id uuid) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
    quiz_entry_fee int;
    user_balance int;
begin
    -- Quiz ka entry fee check karo
    select entry_fee into quiz_entry_fee from public.quizzes where id = p_quiz_id;

    -- User balance check karo
    select wallet_balance into user_balance from public.profiles where id = p_user_id;

    if user_balance < quiz_entry_fee then
        return 'Insufficient Balance';
    end if;

    -- Deduct coins by inserting a debit transaction.
    -- The trigger `trg_tx_sync_profiles` will handle updating the balance.
    insert into public.transactions (user_id, type, amount, status)
    values (p_user_id, 'debit', quiz_entry_fee, 'success');

    -- Add participant
    insert into public.quiz_participants (user_id, quiz_id, status)
    values (p_user_id, p_quiz_id, 'joined');

    return 'Joined Successfully';
end;
$$;


--
-- Name: jwt_claim(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.jwt_claim(claim text) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select coalesce(
    ((select auth.jwt())::jsonb ->> claim),
    ((select current_setting('request.jwt.claims', true))::jsonb ->> claim)
  );
$$;


--
-- Name: process_pending_quizzes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_pending_quizzes() RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
    q record;
begin
    for q in
        select id from public.quizzes
        where end_time < now()
          and status = 'active'
    loop
        perform finalize_quiz_results(q.id);
    end loop;
end;
$$;


--
-- Name: redeem_from_catalog(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.redeem_from_catalog(p_user_id uuid, p_catalog_id uuid) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
    user_balance int;
    catalog_item record;
begin
    -- Fetch catalog item
    select * into catalog_item from public.reward_catalog
    where id = p_catalog_id and is_active = true;

    if not found then
        return 'Invalid Reward';
    end if;

    -- Check balance
    select wallet_balance into user_balance from public.profiles where id = p_user_id;

    if user_balance < catalog_item.coins_required then
        return 'Insufficient Balance';
    end if;

    -- Deduct coins
    update public.profiles
    set wallet_balance = wallet_balance - catalog_item.coins_required
    where id = p_user_id;

    -- Insert transaction
    insert into public.transactions (id, user_id, type, amount, status, created_at)
    values (gen_random_uuid(), p_user_id, 'debit', catalog_item.coins_required, 'success', now());

    -- Insert redemption
    insert into public.redemptions (user_id, reward_type, reward_value, coins_required, catalog_id)
    values (p_user_id, catalog_item.reward_type, catalog_item.reward_value, catalog_item.coins_required, p_catalog_id);

    return 'Redemption Request Submitted';
end;
$$;


--
-- Name: redeem_reward(uuid, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.redeem_reward(p_user_id uuid, p_reward_type text, p_reward_value text, p_coins_required integer) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
    user_balance int;
begin
    -- Check balance
    select wallet_balance into user_balance from public.profiles where id = p_user_id;

    if user_balance < p_coins_required then
        return 'Insufficient Balance';
    end if;

    -- Deduct coins
    update public.profiles
    set wallet_balance = wallet_balance - p_coins_required
    where id = p_user_id;

    -- Insert transaction
    insert into public.transactions (id, user_id, type, amount, status, created_at)
    values (gen_random_uuid(), p_user_id, 'debit', p_coins_required, 'success', now());

    -- Insert redemption request
    insert into public.redemptions (user_id, reward_type, reward_value, coins_required)
    values (p_user_id, p_reward_type, p_reward_value, p_coins_required);

    return 'Redemption Request Submitted';
end;
$$;


--
-- Name: reject_latest_redemption(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_latest_redemption(p_email text, p_reward_value text, p_reason text DEFAULT NULL::text) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
    r_id uuid;
begin
    -- Get latest pending redemption
    select r.id into r_id
    from public.redemptions r
    join public.profiles p on p.id = r.user_id
    where p.email = p_email
      and r.reward_value = p_reward_value
      and r.status = 'pending'
    order by r.requested_at desc
    limit 1;

    if not found then
        return 'No pending redemption found';
    end if;

    -- Reject it
    update public.redemptions
    set status = 'rejected',
        processed_at = now()
    where id = r_id;

    -- (Optional) refund coins
    -- update public.profiles set wallet_balance = wallet_balance + r.coins_required
    -- from public.redemptions r where r.id = r_id and profiles.id = r.user_id;
    -- insert into public.transactions (id, user_id, type, amount, status, created_at)
    -- select gen_random_uuid(), r.user_id, 'refund', r.coins_required, 'success', now()
    -- from public.redemptions r where r.id = r_id;

    return coalesce('Redemption Rejected: ' || p_reason, 'Redemption Rejected');
end;
$$;


--
-- Name: reject_redemption(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_redemption(p_redemption_id uuid, p_reason text DEFAULT NULL::text) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
    update public.redemptions
    set status = 'rejected',
        processed_at = now()
    where id = p_redemption_id
      and status = 'pending';

    if not found then
        return 'Invalid or Already Processed';
    end if;

    -- Optionally: refund coins to user
    -- insert into transactions + update profiles.wallet_balance here
    -- if you want auto refund on rejection

    return coalesce('Redemption Rejected: ' || p_reason, 'Redemption Rejected');
end;
$$;


--
-- Name: reward_referral(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reward_referral() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
    if new.referred_by is not null then
        insert into public.transactions (id, user_id, type, amount, status, created_at)
        values (gen_random_uuid(), new.referred_by, 'referral', 50, 'success', now());

        update public.profiles
        set wallet_balance = wallet_balance + 50
        where id = new.referred_by;

        insert into public.transactions (id, user_id, type, amount, status, created_at)
        values (gen_random_uuid(), new.id, 'referral', 20, 'success', now());

        update public.profiles
        set wallet_balance = wallet_balance + 20
        where id = new.id;
    end if;
    return new;
end;
$$;


--
-- Name: save_push_subscription(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_push_subscription(p_subscription_object jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_user_id uuid;
    v_endpoint text;
BEGIN
    -- Get the user ID from the current session
    v_user_id := auth.uid();

    -- Extract the endpoint from the subscription object
    v_endpoint := p_subscription_object->>'endpoint';

    -- Check if a subscription with this endpoint already exists for this user
    -- If it exists, update it; otherwise, insert a new one.
    INSERT INTO public.push_subscriptions (user_id, subscription_object)
    VALUES (v_user_id, p_subscription_object)
    ON CONFLICT ((subscription_object->>'endpoint')) DO UPDATE
    SET
        user_id = EXCLUDED.user_id,
        subscription_object = EXCLUDED.subscription_object,
        created_at = now();
END;
$$;


--
-- Name: FUNCTION save_push_subscription(p_subscription_object jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.save_push_subscription(p_subscription_object jsonb) IS 'Saves a web push subscription for the current user.';


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end
$$;


--
-- Name: trg_quiz_finished_compute(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_quiz_finished_compute() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ begin if new.status = 'finished' and (old.status is distinct from 'finished') then perform public.compute_quiz_results(new.id); end if; return new; end; $$;


--
-- Name: trg_quiz_notifications(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_quiz_notifications() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Quiz started
  IF TG_OP = 'UPDATE' AND NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active') THEN
    INSERT INTO public.notifications (title, message, type, quiz_id, scheduled_at, created_by)
    VALUES ('Quiz Started', coalesce(NEW.title,'Quiz') || ' has started', 'quiz_start', NEW.id, now(), auth.uid());
  END IF;

  -- Quiz completed (ended)
  IF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    INSERT INTO public.notifications (title, message, type, quiz_id, scheduled_at, created_by)
    VALUES ('Quiz Completed', coalesce(NEW.title,'Quiz') || ' has completed', 'quiz_end', NEW.id, now(), auth.uid());
  END IF;

  -- Result published/changed
  IF TG_OP = 'UPDATE' AND NEW.result_time IS NOT NULL AND (OLD.result_time IS NULL OR NEW.result_time <> OLD.result_time) THEN
    INSERT INTO public.notifications (title, message, type, quiz_id, scheduled_at, created_by)
    VALUES ('Quiz Result', coalesce(NEW.title,'Quiz') || ' result is out', 'quiz_result', NEW.id, NEW.result_time, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: trg_tx_sync_profiles(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_tx_sync_profiles() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public._tx_is_credit(NEW.type) THEN
      UPDATE public.profiles
      SET total_coins = coalesce(total_coins,0) + NEW.amount
      WHERE id = NEW.user_id;
    ELSE
      UPDATE public.profiles
      SET total_spent = coalesce(total_spent,0) + NEW.amount
      WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF public._tx_is_credit(OLD.type) THEN
      UPDATE public.profiles
      SET total_coins = GREATEST(0, coalesce(total_coins,0) - OLD.amount)
      WHERE id = OLD.user_id;
    ELSE
      UPDATE public.profiles
      SET total_spent = GREATEST(0, coalesce(total_spent,0) - OLD.amount)
      WHERE id = OLD.user_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: update_user_claims(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_claims() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
    'is_admin', (NEW.role = 'admin')
  )
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_;

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    declare
      res jsonb;
    begin
      execute format('select to_jsonb(%L::'|| type_::text || ')', val)  into res;
      return res;
    end
    $$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  BEGIN
    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (payload, event, topic, private, extension)
    VALUES (payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: add_prefixes(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.add_prefixes(_bucket_id text, _name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    prefixes text[];
BEGIN
    prefixes := "storage"."get_prefixes"("_name");

    IF array_length(prefixes, 1) > 0 THEN
        INSERT INTO storage.prefixes (name, bucket_id)
        SELECT UNNEST(prefixes) as name, "_bucket_id" ON CONFLICT DO NOTHING;
    END IF;
END;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: delete_prefix(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix(_bucket_id text, _name text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Check if we can delete the prefix
    IF EXISTS(
        SELECT FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name") + 1
          AND "prefixes"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    )
    OR EXISTS(
        SELECT FROM "storage"."objects"
        WHERE "objects"."bucket_id" = "_bucket_id"
          AND "storage"."get_level"("objects"."name") = "storage"."get_level"("_name") + 1
          AND "objects"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    ) THEN
    -- There are sub-objects, skip deletion
    RETURN false;
    ELSE
        DELETE FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name")
          AND "prefixes"."name" = "_name";
        RETURN true;
    END IF;
END;
$$;


--
-- Name: delete_prefix_hierarchy_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix_hierarchy_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    prefix text;
BEGIN
    prefix := "storage"."get_prefix"(OLD."name");

    IF coalesce(prefix, '') != '' THEN
        PERFORM "storage"."delete_prefix"(OLD."bucket_id", prefix);
    END IF;

    RETURN OLD;
END;
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_level(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_level(name text) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


--
-- Name: get_prefix(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefix(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


--
-- Name: get_prefixes(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefixes(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
END;
$_$;


--
-- Name: objects_insert_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_insert_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    NEW.level := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: objects_update_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_prefixes TEXT[];
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Retrieve old prefixes
        old_prefixes := "storage"."get_prefixes"(OLD."name");

        -- Remove old prefixes that are only used by this object
        WITH all_prefixes as (
            SELECT unnest(old_prefixes) as prefix
        ),
        can_delete_prefixes as (
             SELECT prefix
             FROM all_prefixes
             WHERE NOT EXISTS (
                 SELECT 1 FROM "storage"."objects"
                 WHERE "bucket_id" = OLD."bucket_id"
                   AND "name" <> OLD."name"
                   AND "name" LIKE (prefix || '%')
             )
         )
        DELETE FROM "storage"."prefixes" WHERE name IN (SELECT prefix FROM can_delete_prefixes);

        -- Add new prefixes
        PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    END IF;
    -- Set the new level
    NEW."level" := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: prefixes_insert_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_insert_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    RETURN NEW;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql
    AS $$
declare
    can_bypass_rls BOOLEAN;
begin
    SELECT rolbypassrls
    INTO can_bypass_rls
    FROM pg_roles
    WHERE rolname = coalesce(nullif(current_setting('role', true), 'none'), current_user);

    IF can_bypass_rls THEN
        RETURN QUERY SELECT * FROM storage.search_v1_optimised(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    ELSE
        RETURN QUERY SELECT * FROM storage.search_legacy_v1(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    END IF;
end;
$$;


--
-- Name: search_legacy_v1(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v1_optimised(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v1_optimised(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select (string_to_array(name, ''/''))[level] as name
           from storage.prefixes
             where lower(prefixes.name) like lower($2 || $3) || ''%''
               and bucket_id = $4
               and level = $1
           order by name ' || v_sort_order || '
     )
     (select name,
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[level] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where lower(objects.name) like lower($2 || $3) || ''%''
       and bucket_id = $4
       and level = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
BEGIN
    RETURN query EXECUTE
        $sql$
        SELECT * FROM (
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name || '/' AS name,
                    NULL::uuid AS id,
                    NULL::timestamptz AS updated_at,
                    NULL::timestamptz AS created_at,
                    NULL::jsonb AS metadata
                FROM storage.prefixes
                WHERE name COLLATE "C" LIKE $1 || '%'
                AND bucket_id = $2
                AND level = $4
                AND name COLLATE "C" > $5
                ORDER BY prefixes.name COLLATE "C" LIMIT $3
            )
            UNION ALL
            (SELECT split_part(name, '/', $4) AS key,
                name,
                id,
                updated_at,
                created_at,
                metadata
            FROM storage.objects
            WHERE name COLLATE "C" LIKE $1 || '%'
                AND bucket_id = $2
                AND level = $4
                AND name COLLATE "C" > $5
            ORDER BY name COLLATE "C" LIMIT $3)
        ) obj
        ORDER BY name COLLATE "C" LIMIT $3;
        $sql$
        USING prefix, bucket_name, limits, levels, start_after;
END;
$_$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method auth.code_challenge_method NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'stores metadata for pkce logins';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_id text NOT NULL,
    client_secret_hash text NOT NULL,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: daily_streaks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_streaks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    login_date date NOT NULL,
    coins_earned integer DEFAULT 0,
    streak_day integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.levels (
    id integer NOT NULL,
    name text NOT NULL,
    min_coins integer NOT NULL,
    max_coins integer
);


--
-- Name: levels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.levels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: levels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.levels_id_seq OWNED BY public.levels.id;


--
-- Name: quiz_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now(),
    quiz_id uuid,
    score integer DEFAULT 0,
    rank integer,
    status text DEFAULT 'joined'::text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: quiz_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quiz_id uuid NOT NULL,
    leaderboard jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    result_shown_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_id uuid
);


--
-- Name: quizzes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quizzes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    entry_fee numeric,
    prize_pool numeric,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    result_time timestamp with time zone,
    status text DEFAULT 'upcoming'::text,
    prizes jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    category text,
    CONSTRAINT quizzes_status_check_any CHECK (((status IS NULL) OR (status = ANY (ARRAY['upcoming'::text, 'active'::text, 'finished'::text, 'completed'::text]))))
);


--
-- Name: COLUMN quizzes.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quizzes.category IS 'Quiz category label (e.g., GK, Sports, Movies, Opinion) used for filtering on Home page';


--
-- Name: my_quizzes_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.my_quizzes_view WITH (security_invoker='true') AS
 SELECT qp.user_id,
    q.id,
    q.title,
    q.start_time,
    q.end_time,
    q.result_time,
    q.status,
    q.prize_pool,
    qr.leaderboard,
    qr.result_shown_at
   FROM ((public.quiz_participants qp
     JOIN public.quizzes q ON ((qp.quiz_id = q.id)))
     LEFT JOIN public.quiz_results qr ON ((qp.quiz_id = qr.quiz_id)))
  ORDER BY q.start_time DESC;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL,
    quiz_id uuid,
    scheduled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question_id uuid NOT NULL,
    option_text text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text DEFAULT ''::text,
    role text DEFAULT 'user'::text,
    updated_at timestamp with time zone,
    email text,
    total_spent numeric DEFAULT 0 NOT NULL,
    quizzes_played integer DEFAULT 0 NOT NULL,
    quizzes_won integer DEFAULT 0 NOT NULL,
    badges text[] DEFAULT ARRAY[]::text[],
    account_status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    level text,
    username text,
    avatar_url text,
    is_profile_complete boolean DEFAULT false,
    notification_enabled boolean DEFAULT false,
    referral_code text,
    referred_by uuid,
    current_streak integer DEFAULT 0,
    max_streak integer DEFAULT 0,
    last_login_date date,
    mobile_number text,
    total_coins numeric DEFAULT 0 NOT NULL,
    wallet_balance numeric GENERATED ALWAYS AS ((total_coins - total_spent)) STORED
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    subscription_object jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE push_subscriptions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.push_subscriptions IS 'Stores user subscriptions for web push notifications.';


--
-- Name: questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quiz_id uuid NOT NULL,
    question_text text,
    "position" smallint,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quiz_prizes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_prizes (
    id uuid NOT NULL,
    quiz_id uuid NOT NULL,
    rank_from integer NOT NULL,
    rank_to integer NOT NULL,
    prize_coins numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    reward_type text NOT NULL,
    reward_value text NOT NULL,
    coins_required integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now(),
    processed_at timestamp with time zone,
    catalog_id uuid
);


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referrer_id uuid,
    referred_id uuid,
    referral_code text NOT NULL,
    coins_awarded integer DEFAULT 50,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: reward_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reward_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reward_type text NOT NULL,
    reward_value text NOT NULL,
    coins_required integer NOT NULL,
    is_active boolean DEFAULT true
);


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text,
    amount numeric,
    status text DEFAULT 'success'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    description text,
    reference_id uuid,
    CONSTRAINT transactions_type_check CHECK ((lower(type) = ANY (ARRAY['credit'::text, 'reward'::text, 'bonus'::text, 'referral'::text, 'daily_login'::text, 'quiz_reward'::text, 'purchase'::text, 'debit'::text, 'refund'::text])))
);


--
-- Name: user_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    question_id uuid,
    selected_option_id uuid,
    answered_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_quiz_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_quiz_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    quiz_id uuid NOT NULL,
    correct_answers integer DEFAULT 0 NOT NULL,
    attempted_questions integer DEFAULT 0 NOT NULL,
    completed_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE user_quiz_stats; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_quiz_stats IS 'Stores aggregated stats for a user after completing a quiz.';


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


--
-- Name: messages_2025_09_08; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2025_09_08 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2025_09_09; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2025_09_09 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2025_09_10; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2025_09_10 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2025_09_11; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2025_09_11 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2025_09_12; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2025_09_12 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2025_09_13; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2025_09_13 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2025_09_14; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2025_09_14 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb,
    level integer
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: prefixes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.prefixes (
    bucket_id text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    level integer GENERATED ALWAYS AS (storage.get_level(name)) STORED NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text
);


--
-- Name: seed_files; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.seed_files (
    path text NOT NULL,
    hash text NOT NULL
);


--
-- Name: messages_2025_09_08; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2025_09_08 FOR VALUES FROM ('2025-09-08 00:00:00') TO ('2025-09-09 00:00:00');


--
-- Name: messages_2025_09_09; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2025_09_09 FOR VALUES FROM ('2025-09-09 00:00:00') TO ('2025-09-10 00:00:00');


--
-- Name: messages_2025_09_10; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2025_09_10 FOR VALUES FROM ('2025-09-10 00:00:00') TO ('2025-09-11 00:00:00');


--
-- Name: messages_2025_09_11; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2025_09_11 FOR VALUES FROM ('2025-09-11 00:00:00') TO ('2025-09-12 00:00:00');


--
-- Name: messages_2025_09_12; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2025_09_12 FOR VALUES FROM ('2025-09-12 00:00:00') TO ('2025-09-13 00:00:00');


--
-- Name: messages_2025_09_13; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2025_09_13 FOR VALUES FROM ('2025-09-13 00:00:00') TO ('2025-09-14 00:00:00');


--
-- Name: messages_2025_09_14; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2025_09_14 FOR VALUES FROM ('2025-09-14 00:00:00') TO ('2025-09-15 00:00:00');


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: levels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.levels ALTER COLUMN id SET DEFAULT nextval('public.levels_id_seq'::regclass);


--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.audit_log_entries (instance_id, id, payload, created_at, ip_address) FROM stdin;
00000000-0000-0000-0000-000000000000	82ea5c53-a89e-4f6d-a9c3-f735d1387150	{"action":"user_signedup","actor_id":"33ecf52d-a966-4a8c-a0bd-d3648a3e13d8","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"google"}}	2025-07-30 08:48:47.527158+00	
00000000-0000-0000-0000-000000000000	20307342-a4a8-41ea-a352-241913033f5e	{"action":"login","actor_id":"33ecf52d-a966-4a8c-a0bd-d3648a3e13d8","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-07-30 08:56:10.237691+00	
00000000-0000-0000-0000-000000000000	fff8b258-9c8f-409f-924b-f1e1ea24f5a6	{"action":"user_signedup","actor_id":"1f182b7e-cb4e-4f26-8c18-2811379ed6f5","actor_username":"webvolka@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}	2025-07-30 08:56:46.68246+00	
00000000-0000-0000-0000-000000000000	5f852724-19c5-4caf-beb8-0197cbb1d336	{"action":"login","actor_id":"1f182b7e-cb4e-4f26-8c18-2811379ed6f5","actor_username":"webvolka@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-07-30 08:56:46.687777+00	
00000000-0000-0000-0000-000000000000	045796a7-1c9f-4204-a54c-39c88cc13b53	{"action":"user_signedup","actor_id":"59f9e911-996f-4bcc-85ee-8878ca1379e0","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"google"}}	2025-07-30 09:01:12.667847+00	
00000000-0000-0000-0000-000000000000	0d46e6fe-3339-4461-9974-5512b81308f8	{"action":"login","actor_id":"59f9e911-996f-4bcc-85ee-8878ca1379e0","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-07-30 09:14:54.707737+00	
00000000-0000-0000-0000-000000000000	38714d95-533a-419d-ae79-590868f086e6	{"action":"user_signedup","actor_id":"3031c27e-ac9d-4a4f-9c3d-d20704f7342d","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"google"}}	2025-07-30 09:15:18.648294+00	
00000000-0000-0000-0000-000000000000	84c3df45-37c5-428c-8df1-7151d8b0e17d	{"action":"token_refreshed","actor_id":"59f9e911-996f-4bcc-85ee-8878ca1379e0","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-07-30 11:51:07.749084+00	
00000000-0000-0000-0000-000000000000	1595a771-23a7-499a-8275-3afb4121b2bf	{"action":"token_revoked","actor_id":"59f9e911-996f-4bcc-85ee-8878ca1379e0","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-07-30 11:51:07.773165+00	
00000000-0000-0000-0000-000000000000	00b918a6-83ed-470e-85a7-c67184afb37c	{"action":"login","actor_id":"3031c27e-ac9d-4a4f-9c3d-d20704f7342d","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-07-30 18:49:33.498829+00	
00000000-0000-0000-0000-000000000000	58fb224c-98b1-4cfb-a83d-8e985f4a5c93	{"action":"login","actor_id":"3031c27e-ac9d-4a4f-9c3d-d20704f7342d","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-07-30 18:58:44.445256+00	
00000000-0000-0000-0000-000000000000	d270d510-c174-4af7-842f-42d887fd66a6	{"action":"user_signedup","actor_id":"43d48f1b-9488-48da-be3b-ca91f015332a","actor_name":"Fin Prime","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"google"}}	2025-07-30 19:04:25.060753+00	
00000000-0000-0000-0000-000000000000	b4570952-dbeb-4ded-bde0-ccbf2974a56b	{"action":"login","actor_id":"59f9e911-996f-4bcc-85ee-8878ca1379e0","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-07-31 01:29:59.467929+00	
00000000-0000-0000-0000-000000000000	6806c601-3c71-45a9-8203-343707312876	{"action":"login","actor_id":"59f9e911-996f-4bcc-85ee-8878ca1379e0","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-07-31 13:27:15.349057+00	
00000000-0000-0000-0000-000000000000	bdd1e60d-8a01-40df-970e-2c388ed290a6	{"action":"login","actor_id":"59f9e911-996f-4bcc-85ee-8878ca1379e0","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-07-31 13:40:56.062857+00	
00000000-0000-0000-0000-000000000000	07b86206-cc80-4c47-980d-dac72084887f	{"action":"token_refreshed","actor_id":"43d48f1b-9488-48da-be3b-ca91f015332a","actor_name":"Fin Prime","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-07-31 13:44:53.910499+00	
00000000-0000-0000-0000-000000000000	85c6193e-280c-4b35-a330-abbe5eaafa02	{"action":"token_revoked","actor_id":"43d48f1b-9488-48da-be3b-ca91f015332a","actor_name":"Fin Prime","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-07-31 13:44:53.913451+00	
00000000-0000-0000-0000-000000000000	5c981a41-0faf-4bd3-ba2c-e87c15af7715	{"action":"login","actor_id":"59f9e911-996f-4bcc-85ee-8878ca1379e0","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-07-31 13:45:26.156293+00	
00000000-0000-0000-0000-000000000000	2429bd1b-1f8b-496b-9a81-4bcb423a452e	{"action":"login","actor_id":"59f9e911-996f-4bcc-85ee-8878ca1379e0","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-07-31 13:47:30.543118+00	
00000000-0000-0000-0000-000000000000	bba33b39-d6d2-4796-9fe2-7de36141d789	{"action":"token_refreshed","actor_id":"59f9e911-996f-4bcc-85ee-8878ca1379e0","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-07-31 17:07:02.841727+00	
00000000-0000-0000-0000-000000000000	f807d943-962f-40a7-85a0-8cf4444a92d4	{"action":"token_revoked","actor_id":"59f9e911-996f-4bcc-85ee-8878ca1379e0","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-07-31 17:07:02.867598+00	
00000000-0000-0000-0000-000000000000	d8864e6f-3fb8-49b4-bd3b-ca6d8ba78956	{"action":"token_refreshed","actor_id":"43d48f1b-9488-48da-be3b-ca91f015332a","actor_name":"Fin Prime","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-07-31 17:51:15.970963+00	
00000000-0000-0000-0000-000000000000	29874ad3-6637-4d2f-9c42-0a5db3d77e28	{"action":"token_revoked","actor_id":"43d48f1b-9488-48da-be3b-ca91f015332a","actor_name":"Fin Prime","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-07-31 17:51:15.981025+00	
00000000-0000-0000-0000-000000000000	b9d27827-3ca0-4dcf-a674-a38110c504e2	{"action":"login","actor_id":"59f9e911-996f-4bcc-85ee-8878ca1379e0","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-07-31 17:51:46.843905+00	
00000000-0000-0000-0000-000000000000	cc35b444-3909-4ded-9a87-17b9fc230fc6	{"action":"login","actor_id":"33ecf52d-a966-4a8c-a0bd-d3648a3e13d8","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-07-31 18:06:36.851619+00	
00000000-0000-0000-0000-000000000000	6a552fcc-0f9f-41e6-981e-99d3c035500e	{"action":"token_refreshed","actor_id":"33ecf52d-a966-4a8c-a0bd-d3648a3e13d8","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-07-31 19:11:49.882408+00	
00000000-0000-0000-0000-000000000000	5c6bb4a3-10f6-43af-8722-07717b1c2c4e	{"action":"token_revoked","actor_id":"33ecf52d-a966-4a8c-a0bd-d3648a3e13d8","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-07-31 19:11:49.90426+00	
00000000-0000-0000-0000-000000000000	69908fed-bb87-4d99-9a91-61e1e4663c3a	{"action":"login","actor_id":"59f9e911-996f-4bcc-85ee-8878ca1379e0","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-07-31 19:12:30.12241+00	
00000000-0000-0000-0000-000000000000	954dbf1e-cfe1-4b38-9ca5-b502a40c61c2	{"action":"login","actor_id":"59f9e911-996f-4bcc-85ee-8878ca1379e0","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-01 02:15:27.353673+00	
00000000-0000-0000-0000-000000000000	aa5bf1ef-d411-40cf-ac39-b7844600ad89	{"action":"login","actor_id":"59f9e911-996f-4bcc-85ee-8878ca1379e0","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-01 02:20:45.948575+00	
00000000-0000-0000-0000-000000000000	335796cc-d64f-4ccc-a581-64e55185745f	{"action":"token_refreshed","actor_id":"59f9e911-996f-4bcc-85ee-8878ca1379e0","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-01 11:36:21.882343+00	
00000000-0000-0000-0000-000000000000	e8f08f49-c2e3-413e-961f-9c23d6c59904	{"action":"token_revoked","actor_id":"59f9e911-996f-4bcc-85ee-8878ca1379e0","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-01 11:36:21.90953+00	
00000000-0000-0000-0000-000000000000	26bc798f-fed3-4050-9435-ce533a405edf	{"action":"login","actor_id":"59f9e911-996f-4bcc-85ee-8878ca1379e0","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-01 11:37:07.636041+00	
00000000-0000-0000-0000-000000000000	77e6f2d4-d78f-4def-9638-d4a11a4ad934	{"action":"user_deleted","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"user_email":"webvolka@gmail.com","user_id":"1f182b7e-cb4e-4f26-8c18-2811379ed6f5","user_phone":""}}	2025-08-01 11:43:48.571821+00	
00000000-0000-0000-0000-000000000000	8a4892ec-7250-4a05-b303-05168dfd2244	{"action":"user_deleted","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"user_email":"quizdangalbusiness@gmail.com","user_id":"59f9e911-996f-4bcc-85ee-8878ca1379e0","user_phone":""}}	2025-08-01 11:43:48.580792+00	
00000000-0000-0000-0000-000000000000	f1edb72e-e672-4760-bb9a-799d2bd3aee6	{"action":"user_deleted","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"user_email":"quizdangalofficial@gmail.com","user_id":"3031c27e-ac9d-4a4f-9c3d-d20704f7342d","user_phone":""}}	2025-08-01 11:43:48.677985+00	
00000000-0000-0000-0000-000000000000	c9d7bf51-3c9b-48a0-a346-69bf5469e852	{"action":"user_deleted","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"user_email":"sutharji1122@gmail.com","user_id":"33ecf52d-a966-4a8c-a0bd-d3648a3e13d8","user_phone":""}}	2025-08-01 11:43:48.67941+00	
00000000-0000-0000-0000-000000000000	9f5d6129-7586-4bfa-bacd-9cd2203adc31	{"action":"user_deleted","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"user_email":"finprimebusiness@gmail.com","user_id":"43d48f1b-9488-48da-be3b-ca91f015332a","user_phone":""}}	2025-08-01 11:43:48.901221+00	
00000000-0000-0000-0000-000000000000	7d90292a-193a-4df9-970b-6973628da5cc	{"action":"user_signedup","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"provider":"email","user_email":"sutharji1122@gmail.com","user_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","user_phone":""}}	2025-08-01 15:18:35.720834+00	
00000000-0000-0000-0000-000000000000	91a821b1-435f-4dc2-829a-4a661b93d1c9	{"action":"user_signedup","actor_id":"52c31d76-cf00-45a6-8f1c-e4279572671d","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"google"}}	2025-08-01 15:19:18.97821+00	
00000000-0000-0000-0000-000000000000	698b47db-b421-4ca5-8b3a-1af2068599e3	{"action":"user_signedup","actor_id":"f770bf01-7b26-40ba-b49b-6f679d151808","actor_name":"Fin Prime","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"google"}}	2025-08-01 15:19:44.292606+00	
00000000-0000-0000-0000-000000000000	eb9203a2-75b7-467c-b4ee-cbf1fab9c85b	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-01 15:30:21.488206+00	
00000000-0000-0000-0000-000000000000	b0b04201-6426-4347-a555-b8a0d7fc3881	{"action":"user_signedup","actor_id":"5f994211-2129-42a7-aa37-1895ae04d384","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"google"}}	2025-08-01 15:36:15.074348+00	
00000000-0000-0000-0000-000000000000	70f2c105-ae30-4250-aa94-beeabf7da51e	{"action":"login","actor_id":"5f994211-2129-42a7-aa37-1895ae04d384","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-01 15:39:55.653112+00	
00000000-0000-0000-0000-000000000000	05d238a8-b524-49ba-8740-c45354e708bd	{"action":"login","actor_id":"5f994211-2129-42a7-aa37-1895ae04d384","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-01 15:59:34.050056+00	
00000000-0000-0000-0000-000000000000	464917fe-dc17-46e5-a70c-b45370943c4a	{"action":"login","actor_id":"5f994211-2129-42a7-aa37-1895ae04d384","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-01 16:14:53.180024+00	
00000000-0000-0000-0000-000000000000	0644f3f5-6b62-49be-956c-a96ae72f9fcc	{"action":"login","actor_id":"5f994211-2129-42a7-aa37-1895ae04d384","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-01 16:18:08.712906+00	
00000000-0000-0000-0000-000000000000	41c0af8c-9499-4cf4-8bf4-e265dd251f59	{"action":"login","actor_id":"5f994211-2129-42a7-aa37-1895ae04d384","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-01 16:22:58.866462+00	
00000000-0000-0000-0000-000000000000	c9224ebc-6e82-4bdb-a4e9-fa8fd2d520c5	{"action":"login","actor_id":"5f994211-2129-42a7-aa37-1895ae04d384","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-01 16:34:26.112496+00	
00000000-0000-0000-0000-000000000000	405792a0-4ecb-42e5-a498-6bdbadcbfa96	{"action":"token_refreshed","actor_id":"f770bf01-7b26-40ba-b49b-6f679d151808","actor_name":"Fin Prime","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-02 03:43:10.529497+00	
00000000-0000-0000-0000-000000000000	a3e46361-0071-4256-9d21-f3480e40ed02	{"action":"token_revoked","actor_id":"f770bf01-7b26-40ba-b49b-6f679d151808","actor_name":"Fin Prime","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-02 03:43:10.545514+00	
00000000-0000-0000-0000-000000000000	c1eb9c4f-1e7b-444e-a4d4-78f5dfda0767	{"action":"login","actor_id":"5f994211-2129-42a7-aa37-1895ae04d384","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-02 03:44:12.720819+00	
00000000-0000-0000-0000-000000000000	f9540e34-da46-48da-a526-b1fec4454194	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-02 04:16:02.131072+00	
00000000-0000-0000-0000-000000000000	61a64b61-e18d-4e6c-85dd-43ca2ac39726	{"action":"login","actor_id":"5f994211-2129-42a7-aa37-1895ae04d384","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-02 04:17:21.39431+00	
00000000-0000-0000-0000-000000000000	fe77eeff-230c-4df9-a724-64251f381462	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-27 07:40:41.448291+00	
00000000-0000-0000-0000-000000000000	468e846e-fc9d-4ec3-821c-578557bb8553	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-02 04:37:39.36801+00	
00000000-0000-0000-0000-000000000000	5cb55f35-acf3-4984-9604-816c4db7c6e6	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-02 04:43:56.86602+00	
00000000-0000-0000-0000-000000000000	d1723647-f44d-47be-bc93-4ecc8ebfb2b0	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-02 04:48:41.296496+00	
00000000-0000-0000-0000-000000000000	c0d90bb1-c843-47d8-a285-b4841e4a329d	{"action":"token_refreshed","actor_id":"5f994211-2129-42a7-aa37-1895ae04d384","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-02 05:01:46.410268+00	
00000000-0000-0000-0000-000000000000	911cc53b-11ff-4e75-b2e1-f91a35c9037d	{"action":"token_revoked","actor_id":"5f994211-2129-42a7-aa37-1895ae04d384","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-02 05:01:46.41291+00	
00000000-0000-0000-0000-000000000000	7d97bb86-220b-4430-bda9-4b615c620fb6	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-02 05:02:35.473311+00	
00000000-0000-0000-0000-000000000000	29208242-0b9e-44d8-b8fe-70ea74265c4c	{"action":"token_refreshed","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-02 06:44:41.674971+00	
00000000-0000-0000-0000-000000000000	6a9d453d-3322-4268-aae2-5b38e2fda16c	{"action":"token_revoked","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-02 06:44:41.68936+00	
00000000-0000-0000-0000-000000000000	4dde6f9d-2adb-4f39-ad84-23267844aa0a	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-02 06:46:01.087137+00	
00000000-0000-0000-0000-000000000000	8925c228-7461-4282-9826-06947bcfe6c2	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-02 07:18:50.588986+00	
00000000-0000-0000-0000-000000000000	b2fdb947-9557-4cbc-8b49-e34b930d5cd2	{"action":"token_refreshed","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-02 10:00:01.851754+00	
00000000-0000-0000-0000-000000000000	7b5d64b2-087d-48be-93cf-25fe7ec6aa66	{"action":"token_revoked","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-02 10:00:01.881533+00	
00000000-0000-0000-0000-000000000000	bb0b7ffb-5240-4617-81aa-07a16150b1ed	{"action":"token_refreshed","actor_id":"f770bf01-7b26-40ba-b49b-6f679d151808","actor_name":"Fin Prime","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-02 16:33:45.689411+00	
00000000-0000-0000-0000-000000000000	a66914be-7144-4eb5-97b0-6e562f265fee	{"action":"token_revoked","actor_id":"f770bf01-7b26-40ba-b49b-6f679d151808","actor_name":"Fin Prime","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-02 16:33:45.71185+00	
00000000-0000-0000-0000-000000000000	fc04c6f7-91e4-48ba-a1e6-d79e973b1d9f	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-02 16:34:21.112097+00	
00000000-0000-0000-0000-000000000000	de0e5a57-743d-4c81-9555-6422c2208d75	{"action":"token_refreshed","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-02 17:11:13.930306+00	
00000000-0000-0000-0000-000000000000	be20b4c9-9ce5-4b36-beba-77666a685b22	{"action":"token_revoked","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-02 17:11:13.945981+00	
00000000-0000-0000-0000-000000000000	4bedb91b-16cc-497c-bc81-9bd60a783549	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-02 17:12:19.994751+00	
00000000-0000-0000-0000-000000000000	97abe66b-3ef4-4ab0-8d76-c41c8bc41cb8	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-03 17:37:05.465579+00	
00000000-0000-0000-0000-000000000000	fe8cbe4c-8584-4da4-9773-681a6445bb64	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-03 17:40:08.096868+00	
00000000-0000-0000-0000-000000000000	0c30f486-cbbe-40d6-b54e-9ee91aa74084	{"action":"token_refreshed","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-03 17:40:12.043465+00	
00000000-0000-0000-0000-000000000000	767844a1-66e5-4a3e-94bf-33c8316422a5	{"action":"token_revoked","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-03 17:40:12.045876+00	
00000000-0000-0000-0000-000000000000	9f994de0-fb0d-4395-a5c4-0e633316d03e	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-03 17:43:33.939437+00	
00000000-0000-0000-0000-000000000000	36e513ec-ece5-4e28-b8e2-a877c52ab5ec	{"action":"token_refreshed","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-03 17:43:35.181668+00	
00000000-0000-0000-0000-000000000000	f2b71009-23d8-4e24-9135-57e63d2a993d	{"action":"token_revoked","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-03 17:43:35.182255+00	
00000000-0000-0000-0000-000000000000	e46d426a-b849-4d9f-af66-f9b59fc4756e	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-03 17:47:01.365949+00	
00000000-0000-0000-0000-000000000000	dfd0dacd-07dc-4b83-b5b2-7f7532319638	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-04 16:43:58.407771+00	
00000000-0000-0000-0000-000000000000	84e8e032-21a6-4d63-9be1-01349b14959a	{"action":"token_refreshed","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-07 09:14:10.289941+00	
00000000-0000-0000-0000-000000000000	8e987c31-6feb-4022-bf10-a19c9fa2d24a	{"action":"token_revoked","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-07 09:14:10.319298+00	
00000000-0000-0000-0000-000000000000	f113f5c3-0f06-44af-819c-21ce155efe6c	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-07 17:22:52.092685+00	
00000000-0000-0000-0000-000000000000	b2908973-a029-4974-86bc-6fa644e02f84	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-07 17:28:19.959857+00	
00000000-0000-0000-0000-000000000000	c673848b-2c99-4e89-ae79-1e93d19f62a3	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-07 17:34:18.860803+00	
00000000-0000-0000-0000-000000000000	cb1c4fdd-6f2a-4782-bee1-c6a7dc9a8dfe	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-13 02:16:24.225644+00	
00000000-0000-0000-0000-000000000000	5ee53b30-7585-47c7-8bc0-b3a73dbbe213	{"action":"user_deleted","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"user_email":"quizdangalofficial@gmail.com","user_id":"52c31d76-cf00-45a6-8f1c-e4279572671d","user_phone":""}}	2025-08-13 02:23:00.310448+00	
00000000-0000-0000-0000-000000000000	1fee1ab2-9c25-49dc-a9a4-0b5a060887b4	{"action":"user_deleted","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"user_email":"finprimebusiness@gmail.com","user_id":"f770bf01-7b26-40ba-b49b-6f679d151808","user_phone":""}}	2025-08-13 02:23:00.309127+00	
00000000-0000-0000-0000-000000000000	b20de8f4-c672-484d-b615-913d3c3c3a56	{"action":"user_deleted","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"user_email":"quizdangalbusiness@gmail.com","user_id":"5f994211-2129-42a7-aa37-1895ae04d384","user_phone":""}}	2025-08-13 02:23:00.309648+00	
00000000-0000-0000-0000-000000000000	95609fab-a260-45d2-bccf-49e4efd1b2e0	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-13 02:37:20.401598+00	
00000000-0000-0000-0000-000000000000	fe359efb-fd76-47c2-95e6-ce41632228ca	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-13 02:43:47.742605+00	
00000000-0000-0000-0000-000000000000	78ab9894-c481-4be2-8319-a9ee33477d5a	{"action":"user_signedup","actor_id":"0cd6220c-611a-4fc2-9300-3c7b9f709d8f","actor_name":"Govind Suthar","actor_username":"finprimebusinesses@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"google"}}	2025-08-13 02:46:43.686825+00	
00000000-0000-0000-0000-000000000000	3d9d46eb-d7fe-47a5-b4f4-6b3928e0e51c	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-13 02:47:25.146381+00	
00000000-0000-0000-0000-000000000000	60755c2d-5e96-4c0b-921e-eaceacac560f	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-13 02:50:42.839794+00	
00000000-0000-0000-0000-000000000000	221746ba-c170-4e05-b709-bcec92608326	{"action":"user_signedup","actor_id":"8db8ad24-7a80-4c61-ab6e-524ac6b6a09a","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"google"}}	2025-08-13 02:55:46.09066+00	
00000000-0000-0000-0000-000000000000	d5a7f5e4-6d66-4031-8c49-098d2ffb1f03	{"action":"login","actor_id":"8db8ad24-7a80-4c61-ab6e-524ac6b6a09a","actor_name":"Govind","actor_username":"quizdangalbusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-13 02:57:48.132979+00	
00000000-0000-0000-0000-000000000000	1a95f9fc-ab86-479e-9f86-dcad7fad5aa7	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-13 03:01:55.15648+00	
00000000-0000-0000-0000-000000000000	bb8d0860-e942-4e81-997f-a2748fab2c00	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-13 03:54:03.569762+00	
00000000-0000-0000-0000-000000000000	3d906f30-c0f9-4684-bfe5-fb8d3421fa8f	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-13 08:01:31.721967+00	
00000000-0000-0000-0000-000000000000	cd987955-713b-4fda-baf5-182441996737	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-13 08:08:35.163813+00	
00000000-0000-0000-0000-000000000000	80d8bba7-528e-4c37-bffe-0cbb75f82eec	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-14 04:57:15.869819+00	
00000000-0000-0000-0000-000000000000	928e53df-2330-4b83-baba-5549e53b8874	{"action":"token_refreshed","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-14 04:59:15.549058+00	
00000000-0000-0000-0000-000000000000	f8cbddea-6dba-40d1-97e4-0ad4108a7560	{"action":"token_revoked","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-14 04:59:15.551017+00	
00000000-0000-0000-0000-000000000000	cce95083-c4bc-48bf-89f4-d98a884cb22a	{"action":"token_refreshed","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-14 06:40:16.896892+00	
00000000-0000-0000-0000-000000000000	8fe8f217-6e41-447f-9449-e0bc8b1d7a98	{"action":"token_revoked","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-14 06:40:16.9205+00	
00000000-0000-0000-0000-000000000000	06458483-a8b7-4d78-a513-063434ab8394	{"action":"token_refreshed","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-14 06:40:18.279831+00	
00000000-0000-0000-0000-000000000000	6acfde2c-69f2-4340-972c-7650a65e65f3	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-16 10:12:54.829908+00	
00000000-0000-0000-0000-000000000000	b99e50d0-9aa6-4905-b5ac-a9a2c8de2f5d	{"action":"token_refreshed","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-16 10:38:12.528855+00	
00000000-0000-0000-0000-000000000000	ee475b45-2f20-443c-bcf4-7eb4ad6f0045	{"action":"token_revoked","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-16 10:38:12.534144+00	
00000000-0000-0000-0000-000000000000	4843d967-19af-4676-9d46-e1753b27c339	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 15:29:16.37356+00	
00000000-0000-0000-0000-000000000000	72af34f5-2078-4a08-9911-b3ae0cd89e72	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-16 10:38:53.681573+00	
00000000-0000-0000-0000-000000000000	d045149e-9fda-4654-825e-be2b4a7893e0	{"action":"token_refreshed","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-16 11:13:58.924851+00	
00000000-0000-0000-0000-000000000000	17b175f5-c3d0-4138-bec6-ae3569fbafc9	{"action":"token_revoked","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-16 11:13:58.939918+00	
00000000-0000-0000-0000-000000000000	6f44acae-1580-4cd1-bf62-1fae4cd54a6f	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-16 11:14:31.27293+00	
00000000-0000-0000-0000-000000000000	4a69e4d3-cd8a-4c71-908b-6e63ead0ceb9	{"action":"logout","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-16 11:14:46.336759+00	
00000000-0000-0000-0000-000000000000	8b2f42db-92ff-4b42-8109-d53b4a8724d3	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-16 11:17:51.323404+00	
00000000-0000-0000-0000-000000000000	17a3de6f-56fb-478c-9ed2-93e72a763112	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-16 11:28:07.742832+00	
00000000-0000-0000-0000-000000000000	413454da-f14e-4e5a-a04a-174af81fd7d7	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-16 11:30:14.805096+00	
00000000-0000-0000-0000-000000000000	d1fc75a8-5cf2-4146-83c3-35354273512d	{"action":"user_signedup","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"google"}}	2025-08-16 14:53:28.480252+00	
00000000-0000-0000-0000-000000000000	3a7a822a-5c45-4d9a-a742-e151275bd4aa	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-16 15:44:26.28575+00	
00000000-0000-0000-0000-000000000000	64124b5c-c70f-4159-80b2-dd1601046ab3	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-16 15:45:36.750569+00	
00000000-0000-0000-0000-000000000000	7889d19c-1599-488c-8664-5d2c10409fae	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-16 15:47:38.656379+00	
00000000-0000-0000-0000-000000000000	a53e1773-097c-437a-bb7a-ac97b7784ae5	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-16 15:50:48.147888+00	
00000000-0000-0000-0000-000000000000	4589f760-4abb-4dbe-a15c-57a72d697c7a	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-16 15:55:37.566582+00	
00000000-0000-0000-0000-000000000000	d7c9872e-14a0-43c1-b627-ae80f9cd26e4	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-16 15:59:25.92046+00	
00000000-0000-0000-0000-000000000000	c1b4b0cf-3991-4e13-bb31-4b0aa02d749f	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-16 16:03:40.852464+00	
00000000-0000-0000-0000-000000000000	a529be0b-4c4b-4531-98c0-4abe5f017dbf	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-16 16:14:43.730311+00	
00000000-0000-0000-0000-000000000000	bd1539d8-020b-4fd6-83c2-e7e981466d61	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-16 16:19:36.14903+00	
00000000-0000-0000-0000-000000000000	29b8a0b9-6d40-4da1-b291-e15fe90303b0	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-16 16:20:04.1571+00	
00000000-0000-0000-0000-000000000000	5bdd6d6b-0f3b-40a2-a730-9ada1c3384c4	{"action":"logout","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-16 16:20:10.723862+00	
00000000-0000-0000-0000-000000000000	6fd3b42e-ad88-4f77-8130-daa68c0192ef	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-16 16:20:26.513288+00	
00000000-0000-0000-0000-000000000000	318b91a6-16f9-4bb3-b56b-595de2a44c9c	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-16 16:23:28.408087+00	
00000000-0000-0000-0000-000000000000	893b5d46-0afc-4a17-9811-18a622e96e36	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-16 16:27:09.660381+00	
00000000-0000-0000-0000-000000000000	fb374ab7-576d-43dc-b19b-8a52a6bd1828	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-17 01:55:32.078304+00	
00000000-0000-0000-0000-000000000000	d8a26049-05b2-41b1-a39a-41869f69661f	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-18 16:27:09.368777+00	
00000000-0000-0000-0000-000000000000	f9674a20-be65-428e-a45c-c1411b36337d	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-18 16:35:52.642403+00	
00000000-0000-0000-0000-000000000000	fc68c3fd-9a14-4dc1-b217-663de8e494f4	{"action":"token_refreshed","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-18 17:50:31.534119+00	
00000000-0000-0000-0000-000000000000	118c7a8a-c170-42fe-b3b8-9837eebbfdd6	{"action":"token_revoked","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-18 17:50:31.558892+00	
00000000-0000-0000-0000-000000000000	9e77e7b4-f0e6-4371-97d4-b299275dc5a7	{"action":"token_refreshed","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-19 12:56:12.62932+00	
00000000-0000-0000-0000-000000000000	91f55f43-08ba-402f-998c-fcba28a6835f	{"action":"token_revoked","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-19 12:56:12.646328+00	
00000000-0000-0000-0000-000000000000	130fc6d1-c980-4699-95bb-b4ad72a79707	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-20 17:03:45.919858+00	
00000000-0000-0000-0000-000000000000	e34b7dc5-64a5-4188-8cdb-4dacbfb3a79d	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-20 18:38:05.765195+00	
00000000-0000-0000-0000-000000000000	90c61dc4-44d7-49bb-a7b9-463627e92e50	{"action":"user_signedup","actor_id":"6c054754-f4cf-413d-9386-abffd2c936da","actor_name":"Govind","actor_username":"govindsuthar.me@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"google"}}	2025-08-20 18:40:48.270778+00	
00000000-0000-0000-0000-000000000000	85e9f950-8520-41f9-b146-e0fd60a0eaea	{"action":"logout","actor_id":"6c054754-f4cf-413d-9386-abffd2c936da","actor_name":"Govind","actor_username":"govindsuthar.me@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-20 18:41:23.942873+00	
00000000-0000-0000-0000-000000000000	7117274f-9741-4608-a35d-7cf6acb747b6	{"action":"login","actor_id":"6c054754-f4cf-413d-9386-abffd2c936da","actor_name":"Govind","actor_username":"govindsuthar.me@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-20 19:56:46.545622+00	
00000000-0000-0000-0000-000000000000	d8847ba8-c334-4e1e-8f6b-71b68070b049	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-20 19:57:38.019534+00	
00000000-0000-0000-0000-000000000000	30302793-7d6a-4cec-9b04-18e1e90ca35d	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-20 20:00:17.870947+00	
00000000-0000-0000-0000-000000000000	457a61b5-dba8-4490-8e84-4e471fc60892	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-20 20:02:05.537242+00	
00000000-0000-0000-0000-000000000000	30f00ada-7182-4333-9af2-e089c0367795	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-20 20:05:42.14131+00	
00000000-0000-0000-0000-000000000000	e2ee0724-b6f6-490a-90f2-6466d573178a	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-20 20:28:11.377286+00	
00000000-0000-0000-0000-000000000000	f75a76e1-7a3d-43bb-97a9-0d27349561f9	{"action":"token_refreshed","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-20 21:44:36.261052+00	
00000000-0000-0000-0000-000000000000	a7f463b0-e38a-4a0a-a746-45ce0b6a8dec	{"action":"token_revoked","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-20 21:44:36.282958+00	
00000000-0000-0000-0000-000000000000	f52fe1d9-802f-41b3-a41d-b987f852f212	{"action":"token_refreshed","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-21 05:51:45.62156+00	
00000000-0000-0000-0000-000000000000	41ca91e2-8267-469e-88d6-ae2838ebb376	{"action":"token_revoked","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-21 05:51:45.649395+00	
00000000-0000-0000-0000-000000000000	e911b492-b0bf-4867-8ede-28a35a8fdf50	{"action":"token_refreshed","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-21 08:53:46.881375+00	
00000000-0000-0000-0000-000000000000	5ecce734-98b0-4b8b-a659-80388f98e1b2	{"action":"token_revoked","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-21 08:53:46.90852+00	
00000000-0000-0000-0000-000000000000	9a0bfc1a-3fa7-4aab-8cb4-c546eb5846b6	{"action":"token_refreshed","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-21 11:02:52.555217+00	
00000000-0000-0000-0000-000000000000	a70f63ed-032a-45e0-a7a4-03d0407239be	{"action":"token_revoked","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-21 11:02:52.578011+00	
00000000-0000-0000-0000-000000000000	91ad1a74-c051-43ea-8aed-1af747ee507c	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-21 11:08:49.16751+00	
00000000-0000-0000-0000-000000000000	7029792c-a9f1-41ec-94b8-8ec600a484cb	{"action":"logout","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-21 11:11:44.992916+00	
00000000-0000-0000-0000-000000000000	3f0ce81f-5c03-45fb-a0e1-c15ec879c4ac	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-21 15:36:56.798437+00	
00000000-0000-0000-0000-000000000000	248e144a-b4ac-4313-8f5b-878cdbaf0101	{"action":"token_refreshed","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-22 09:01:06.266292+00	
00000000-0000-0000-0000-000000000000	076bbe26-2918-40bb-a551-61ce06d240cb	{"action":"token_revoked","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-22 09:01:06.284881+00	
00000000-0000-0000-0000-000000000000	f4fda939-2958-4148-bc2f-1547a2cc1fb3	{"action":"logout","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-22 09:01:10.115055+00	
00000000-0000-0000-0000-000000000000	9452891c-0bd3-4252-864a-f5e8b03dfdab	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-22 09:01:24.153325+00	
00000000-0000-0000-0000-000000000000	fe1e8dd5-e57f-4a35-843a-71963f74e943	{"action":"logout","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-22 09:01:26.325984+00	
00000000-0000-0000-0000-000000000000	796bca8e-7c41-43fb-9b26-755b413e1129	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-22 09:01:43.307881+00	
00000000-0000-0000-0000-000000000000	0debacdc-58da-4c51-8a16-1921ba7125f2	{"action":"login","actor_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-22 09:06:36.473782+00	
00000000-0000-0000-0000-000000000000	ac543bc5-b849-47bf-91fc-24a749dd070d	{"action":"user_deleted","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"user_email":"sutharji1122@gmail.com","user_id":"3c0d214e-e9f4-4b7b-8dbc-820bea328e4f","user_phone":""}}	2025-08-22 09:39:00.028122+00	
00000000-0000-0000-0000-000000000000	5dc73010-44c6-4780-a1e9-c82a9f991dfe	{"action":"user_signedup","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}	2025-08-23 14:49:34.856027+00	
00000000-0000-0000-0000-000000000000	40a5048a-58d4-4636-bdb5-6b61cf63bc93	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-23 14:49:34.89612+00	
00000000-0000-0000-0000-000000000000	3c5b4e72-ee84-4376-87a5-69963d78cc09	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-24 11:19:23.803439+00	
00000000-0000-0000-0000-000000000000	56663a72-2a41-4dba-b891-9a8f28577578	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-24 15:50:58.587824+00	
00000000-0000-0000-0000-000000000000	d7a849fe-e484-49b7-8dc4-0bbfebb675a7	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-24 15:50:58.601793+00	
00000000-0000-0000-0000-000000000000	265b4dad-89f6-491c-8b2f-903e973b7d9a	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-24 15:59:08.651504+00	
00000000-0000-0000-0000-000000000000	a97e7466-13bb-4403-b7d7-0d6ce3d1e128	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-24 15:59:34.307038+00	
00000000-0000-0000-0000-000000000000	86602184-d591-499d-8f67-46a75021b5aa	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-25 18:08:52.657929+00	
00000000-0000-0000-0000-000000000000	d5a5fe21-981a-48c1-bb85-4f5ae7786b22	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-25 18:10:30.325771+00	
00000000-0000-0000-0000-000000000000	1183d59d-2748-45fe-8042-524a9930cf75	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-25 18:29:14.751185+00	
00000000-0000-0000-0000-000000000000	aae6bec3-7f6b-4846-ada1-5627581388be	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-25 18:31:11.647018+00	
00000000-0000-0000-0000-000000000000	412b299a-f14c-419d-91ac-4b3912ab4f30	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-25 18:46:52.768915+00	
00000000-0000-0000-0000-000000000000	b365655e-ca9b-450d-a6d6-a9c40733f40c	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-25 18:47:15.50451+00	
00000000-0000-0000-0000-000000000000	fbbe5d93-3024-4fea-8b18-a4bccb92ba3e	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-25 18:47:15.505114+00	
00000000-0000-0000-0000-000000000000	770e5479-c354-44c6-bd96-a96d9e28feea	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-25 18:48:24.403043+00	
00000000-0000-0000-0000-000000000000	4898ffef-0ab7-402e-8433-94866658fa9b	{"action":"token_refreshed","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-25 19:36:30.537914+00	
00000000-0000-0000-0000-000000000000	007b96f3-f4fe-4567-8c99-41f460a77f77	{"action":"token_revoked","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-25 19:36:30.549903+00	
00000000-0000-0000-0000-000000000000	3fa69eb3-fc5e-41cd-9ebc-57eab7f793b6	{"action":"token_refreshed","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-25 19:48:13.189126+00	
00000000-0000-0000-0000-000000000000	2e70553b-89c2-4cd7-ae52-bd218bfa9afa	{"action":"token_revoked","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-25 19:48:13.196583+00	
00000000-0000-0000-0000-000000000000	75a1c480-4d3e-4e4f-88e5-465d51517b56	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-25 20:03:23.640141+00	
00000000-0000-0000-0000-000000000000	af189ddc-049a-4343-b5a6-d000358569a1	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-25 20:04:48.625381+00	
00000000-0000-0000-0000-000000000000	f61dc054-92bf-4e27-a73a-4a6ab2fde286	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-26 04:43:50.739908+00	
00000000-0000-0000-0000-000000000000	483020a7-ac74-4966-a251-d3295e643dca	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-26 04:43:50.759912+00	
00000000-0000-0000-0000-000000000000	9da42786-a039-4858-aadb-c3abfa6ebddb	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-26 04:45:00.811382+00	
00000000-0000-0000-0000-000000000000	8a3d16fa-dc96-4075-99e8-a89503a73949	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-26 04:45:39.661715+00	
00000000-0000-0000-0000-000000000000	ee2694e6-0242-4afb-b793-3eb2a6003dcf	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-26 04:45:39.662675+00	
00000000-0000-0000-0000-000000000000	6b633fde-83ba-4894-b2e8-54a50db089f2	{"action":"logout","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-26 04:45:59.955786+00	
00000000-0000-0000-0000-000000000000	e5b2b637-29db-4472-91e5-8fd4f66f12e6	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-26 04:46:09.511148+00	
00000000-0000-0000-0000-000000000000	450ef48e-0cf3-46ff-8dd4-ed4727523f7a	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-26 06:58:47.817129+00	
00000000-0000-0000-0000-000000000000	ead7fe26-beba-431f-934b-3fa745bf17e2	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-26 07:00:16.586714+00	
00000000-0000-0000-0000-000000000000	7e99ab7a-a42e-476d-88ab-5f8d0ef729ce	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-26 07:08:40.723864+00	
00000000-0000-0000-0000-000000000000	34672e21-632b-465d-bf95-f863d892735a	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-26 08:07:51.321314+00	
00000000-0000-0000-0000-000000000000	3fe9c4c1-20fd-4453-89e0-5a54d1d632e7	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-26 08:07:51.332486+00	
00000000-0000-0000-0000-000000000000	90bc0e21-ee65-4fc1-8a85-faea42c313f6	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-26 12:37:24.018077+00	
00000000-0000-0000-0000-000000000000	3ada7810-6160-4fa9-ab5e-ffea80d8065a	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-26 12:37:24.03478+00	
00000000-0000-0000-0000-000000000000	7fbeaaaa-a6f4-4c69-97d4-ff53b7abc562	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-26 14:06:54.876276+00	
00000000-0000-0000-0000-000000000000	740ccb89-3356-4917-984e-9136fc104a34	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-26 14:06:54.902132+00	
00000000-0000-0000-0000-000000000000	cca4b7b1-50f6-4afa-bd1d-5149696bbeb1	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-26 15:10:15.525764+00	
00000000-0000-0000-0000-000000000000	4600490f-b1a5-4a4a-8c51-1aa30e6c4887	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-26 15:10:15.543917+00	
00000000-0000-0000-0000-000000000000	035067e6-a197-41ff-9e62-4a8c7b05628f	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-26 15:44:38.904585+00	
00000000-0000-0000-0000-000000000000	1c00a066-59a4-437a-9535-34aa237edf9a	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-26 15:55:10.968624+00	
00000000-0000-0000-0000-000000000000	f0d46497-7179-4e80-8608-8ffebfafd276	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-26 16:07:40.326124+00	
00000000-0000-0000-0000-000000000000	fe4b62ad-3026-4a51-a981-79e252bfddfd	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-27 03:40:42.394093+00	
00000000-0000-0000-0000-000000000000	ab2de010-920c-428d-99cc-63ab2a09a334	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-27 03:40:42.410546+00	
00000000-0000-0000-0000-000000000000	b2087d60-6e87-4037-b340-86155c6574fd	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-27 06:10:55.740458+00	
00000000-0000-0000-0000-000000000000	e796c893-f588-45d5-9739-fedfbe9c82ce	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-27 06:10:55.764155+00	
00000000-0000-0000-0000-000000000000	136f95b4-0a15-4e7c-821a-fafb16528c18	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-27 06:11:45.630295+00	
00000000-0000-0000-0000-000000000000	f02594a6-72ad-4d37-b704-ad315234c617	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-27 06:11:45.63405+00	
00000000-0000-0000-0000-000000000000	00341821-54cc-4381-8f5c-19ec013f29e1	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-27 06:25:19.732704+00	
00000000-0000-0000-0000-000000000000	3d292e24-9440-4ed2-9038-ecc068aa69f7	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-27 06:25:27.393497+00	
00000000-0000-0000-0000-000000000000	4dc3807f-eedc-468c-808b-cf9dfdb2db28	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-27 06:26:19.216973+00	
00000000-0000-0000-0000-000000000000	52b04e37-b5e2-450b-853d-fef366120d5d	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-27 06:29:26.865591+00	
00000000-0000-0000-0000-000000000000	e6f606f0-42e3-482b-94c2-a8def7f87638	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-27 06:48:36.999877+00	
00000000-0000-0000-0000-000000000000	17186f10-f530-4eaf-a709-0966a56fcfdc	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-27 07:12:29.690064+00	
00000000-0000-0000-0000-000000000000	8e82a2ce-a5d1-4fcf-8d6b-d11727348933	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-27 07:17:11.355099+00	
00000000-0000-0000-0000-000000000000	78783940-86ad-4b01-b1f1-a9a834805f69	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-27 07:31:36.484671+00	
00000000-0000-0000-0000-000000000000	a52e2880-ac68-4841-9e50-5be99b19c68f	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-27 08:43:59.535694+00	
00000000-0000-0000-0000-000000000000	e6067036-dbeb-423d-8788-441dfa0b0db3	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-27 08:53:57.797273+00	
00000000-0000-0000-0000-000000000000	eab22ff6-cc53-40b8-a1fd-05dccf7c73fb	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-27 09:18:54.245176+00	
00000000-0000-0000-0000-000000000000	2db402ab-6556-46be-b2ae-e72c14b81431	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-27 09:24:24.143086+00	
00000000-0000-0000-0000-000000000000	cbb9236a-e8c5-4779-86b9-1e7b9f334345	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-27 09:25:12.668621+00	
00000000-0000-0000-0000-000000000000	ac2ab0ab-aa5e-447f-9567-009af6373c79	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-27 09:25:19.159365+00	
00000000-0000-0000-0000-000000000000	5629540a-c9a6-4100-9aec-90d1b608f291	{"action":"user_recovery_requested","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-27 09:25:27.328609+00	
00000000-0000-0000-0000-000000000000	7f08a744-4dd1-4425-b808-11a56e2ec3bf	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-27 09:25:58.697414+00	
00000000-0000-0000-0000-000000000000	2b39cd00-b79e-49e0-be41-6086bfa808da	{"action":"user_recovery_requested","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-27 10:06:08.310589+00	
00000000-0000-0000-0000-000000000000	8fde24ac-7e22-4551-aa38-f5b91733ac4c	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-27 10:27:11.07675+00	
00000000-0000-0000-0000-000000000000	a09929f7-88dd-423d-9e4c-03a826532e13	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-27 10:50:00.716869+00	
00000000-0000-0000-0000-000000000000	2ef42da7-55e9-4135-a55a-dcc3365e92ba	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-27 10:51:12.91208+00	
00000000-0000-0000-0000-000000000000	0c5fa523-6945-42b9-9de5-fc90c34ce0d9	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-27 15:51:21.822753+00	
00000000-0000-0000-0000-000000000000	1c07f6a5-a17c-497a-b7f5-806ed2c8a6cb	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-27 18:08:59.751113+00	
00000000-0000-0000-0000-000000000000	d95f3a7b-6325-4810-aeb9-8fdfda6a1d5c	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-27 18:08:59.776356+00	
00000000-0000-0000-0000-000000000000	02f6382b-d87f-4667-bca5-556db3f6bb11	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-28 10:40:26.089069+00	
00000000-0000-0000-0000-000000000000	379c0aa3-ef30-4d3d-9761-e9f162609946	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-28 10:40:26.102473+00	
00000000-0000-0000-0000-000000000000	267a5e7d-2acf-4433-b8ad-af86dd0a6fbf	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 10:40:33.261606+00	
00000000-0000-0000-0000-000000000000	e3a3f40d-f859-494f-89b1-85beb303ba09	{"action":"user_invited","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"user_email":"finprimebusiness@gmail.com","user_id":"4f149df7-36b3-498d-8c9a-8663b6cc35ee"}}	2025-08-28 11:07:41.088873+00	
00000000-0000-0000-0000-000000000000	126d58bb-fa3c-462d-96af-514e361e29ac	{"action":"user_recovery_requested","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-28 12:25:33.767365+00	
00000000-0000-0000-0000-000000000000	08810de5-509e-4b24-a90b-31bc5b490af9	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 12:30:56.845669+00	
00000000-0000-0000-0000-000000000000	3376668e-2d47-4666-8e3e-ee9e8763de1d	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 12:31:06.393587+00	
00000000-0000-0000-0000-000000000000	36cbfcf2-5bcb-4254-aea6-ebf5f3cdba88	{"action":"user_recovery_requested","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-28 12:31:31.257668+00	
00000000-0000-0000-0000-000000000000	affc367d-22ea-477a-9c1b-7386c69fc896	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 12:31:48.776925+00	
00000000-0000-0000-0000-000000000000	8e92d943-f9fc-465a-b0c7-6568fa2be524	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 12:31:56.121104+00	
00000000-0000-0000-0000-000000000000	fda53eaa-3874-4cbc-90a7-d2bd29189881	{"action":"user_recovery_requested","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-28 12:42:51.327393+00	
00000000-0000-0000-0000-000000000000	fa32403c-a85f-47c5-97f3-002b2fed6bc2	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 12:43:29.969071+00	
00000000-0000-0000-0000-000000000000	cd65ccd1-fa93-4763-a68c-4b6ef1cbe2c1	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 12:43:37.577844+00	
00000000-0000-0000-0000-000000000000	0c31d4fa-3c3f-4a53-97cb-172c6fdaaaa7	{"action":"user_recovery_requested","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-28 12:44:25.797674+00	
00000000-0000-0000-0000-000000000000	cfd95549-b602-4027-b626-aec71256b018	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 12:44:44.055391+00	
00000000-0000-0000-0000-000000000000	48fa3aba-bafa-4ece-a058-1d900c8857b1	{"action":"user_recovery_requested","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-28 13:03:44.645006+00	
00000000-0000-0000-0000-000000000000	49df455e-64be-4ef8-ac99-456534489ce1	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 13:04:09.925328+00	
00000000-0000-0000-0000-000000000000	b50fe34e-abd1-4fe4-b77c-e4cf7e8ba8f0	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-28 15:25:18.026908+00	
00000000-0000-0000-0000-000000000000	eac93ca0-36fa-4812-867a-dec81f474599	{"action":"logout","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 15:28:17.900052+00	
00000000-0000-0000-0000-000000000000	e7cf6eb2-b300-4dca-baec-fdeb8c5f0a3c	{"action":"user_recovery_requested","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-28 15:28:36.338965+00	
00000000-0000-0000-0000-000000000000	8f49186c-7e11-4133-96fc-23fb007c22e7	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-28 15:37:00.779122+00	
00000000-0000-0000-0000-000000000000	7cbfe53c-57c4-49c9-8e89-b45589d7af64	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-28 15:38:14.006497+00	
00000000-0000-0000-0000-000000000000	df5ac3f5-25f0-4a41-b938-282a8f7bc9e6	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 15:43:32.754958+00	
00000000-0000-0000-0000-000000000000	e7fb92bc-d4dc-4774-b7f4-f69d11046162	{"action":"user_recovery_requested","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-28 15:43:41.291338+00	
00000000-0000-0000-0000-000000000000	a0a8da53-2431-4aaa-b5f0-6e8b2d533886	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 15:44:05.749254+00	
00000000-0000-0000-0000-000000000000	59f83cfa-e0ff-4a95-8d50-bae1053c7b1b	{"action":"user_recovery_requested","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-28 15:44:44.785509+00	
00000000-0000-0000-0000-000000000000	a79a8608-0c18-412f-beef-144f54cc4d06	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 15:44:59.947941+00	
00000000-0000-0000-0000-000000000000	7dad5894-d8af-49bd-b507-806a878d9bdb	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 15:48:20.83238+00	
00000000-0000-0000-0000-000000000000	73f5cde1-3a70-465d-a94e-ef2861c7f793	{"action":"user_recovery_requested","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-28 15:48:27.246494+00	
00000000-0000-0000-0000-000000000000	e438068b-196b-43ae-940a-002a83eac405	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 15:48:42.962429+00	
00000000-0000-0000-0000-000000000000	18e66bd0-e649-46c6-b9e3-0ebe01202e1f	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-28 15:59:19.845356+00	
00000000-0000-0000-0000-000000000000	9a05b5d8-de90-42da-a205-335b04fb5686	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 15:59:26.587221+00	
00000000-0000-0000-0000-000000000000	7843332e-a107-4d29-b277-cfa7983a42ec	{"action":"user_recovery_requested","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-28 16:00:23.54595+00	
00000000-0000-0000-0000-000000000000	706c5a91-676f-4c69-9203-d19c68cc5f33	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 16:00:55.386737+00	
00000000-0000-0000-0000-000000000000	10e452d4-5933-4917-aa7e-e09495270d48	{"action":"user_updated_password","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-28 16:01:07.217502+00	
00000000-0000-0000-0000-000000000000	04372a91-0e85-401b-b44a-e0dc6edcc902	{"action":"user_modified","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-28 16:01:07.218214+00	
00000000-0000-0000-0000-000000000000	0850e61b-b230-4776-b44a-d4286b0d84fb	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 16:01:07.340088+00	
00000000-0000-0000-0000-000000000000	1a4ef1eb-90b4-4829-9de6-c2d2f3c8fa1e	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-28 16:01:39.198858+00	
00000000-0000-0000-0000-000000000000	4689fc32-b450-4ec4-896b-aa3a36f038b0	{"action":"logout","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 16:09:35.151746+00	
00000000-0000-0000-0000-000000000000	c3edee7d-c764-4ae3-aa5c-9eb4da5979bb	{"action":"user_recovery_requested","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-28 16:09:47.283954+00	
00000000-0000-0000-0000-000000000000	d8540172-028f-489f-b3d0-9b31bfc03ea8	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 16:11:36.915656+00	
00000000-0000-0000-0000-000000000000	7800a76d-668a-4652-8bd7-150ac9c8e1a1	{"action":"user_updated_password","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-28 16:11:55.61213+00	
00000000-0000-0000-0000-000000000000	e74e8432-bbc5-406a-b681-f19ec1aa670a	{"action":"user_modified","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-28 16:11:55.613633+00	
00000000-0000-0000-0000-000000000000	69c448b9-fe31-4eb7-96eb-ce36d2c2047e	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 16:11:55.751819+00	
00000000-0000-0000-0000-000000000000	c51cd42a-f088-4b65-8a1d-9f84a01d7098	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-28 16:12:36.282417+00	
00000000-0000-0000-0000-000000000000	93cf169e-f475-4ae2-91d3-63dde31a40f8	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 16:12:41.131897+00	
00000000-0000-0000-0000-000000000000	fe7b05e0-e460-4e45-a16d-5ac657e68324	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-28 16:23:45.37861+00	
00000000-0000-0000-0000-000000000000	2cc3a83c-ccb0-45b2-b82c-47a2ffc54236	{"action":"logout","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 16:23:50.760754+00	
00000000-0000-0000-0000-000000000000	53bfb4d2-bffd-4927-9d04-8634d008b06d	{"action":"user_recovery_requested","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-28 16:37:22.421997+00	
00000000-0000-0000-0000-000000000000	50d62af8-793f-401a-9c8e-49199f1d0a57	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 16:37:40.021636+00	
00000000-0000-0000-0000-000000000000	1c2c7195-3bfc-4d57-8f0b-d085a170fa58	{"action":"user_updated_password","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-28 16:38:09.139341+00	
00000000-0000-0000-0000-000000000000	ff853128-de41-4356-bcb5-fd8e52e37057	{"action":"user_modified","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-28 16:38:09.143083+00	
00000000-0000-0000-0000-000000000000	76d61192-c8f3-4428-9676-5f508ce0a06e	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 16:38:09.281191+00	
00000000-0000-0000-0000-000000000000	ecb1f283-26f2-4351-81bb-e1d6ffa9e7f1	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-28 16:38:28.348989+00	
00000000-0000-0000-0000-000000000000	f664da8a-17c6-4788-a141-4c3fe3c060af	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 16:38:34.045366+00	
00000000-0000-0000-0000-000000000000	06c77f87-e1b7-47fa-b5ff-00e772e8cacb	{"action":"user_signedup","actor_id":"4f149df7-36b3-498d-8c9a-8663b6cc35ee","actor_name":"Fin Prime","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"google"}}	2025-08-28 16:46:58.032751+00	
00000000-0000-0000-0000-000000000000	df927feb-4e58-4100-8eea-04f0db4dde33	{"action":"logout","actor_id":"4f149df7-36b3-498d-8c9a-8663b6cc35ee","actor_name":"Fin Prime","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-28 16:53:31.903644+00	
00000000-0000-0000-0000-000000000000	5ea7918e-11ca-4190-808b-1ce50c36fd4b	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-28 16:55:19.498468+00	
00000000-0000-0000-0000-000000000000	3903978e-b439-485a-9f56-3e814dbb5dd1	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 03:32:01.554831+00	
00000000-0000-0000-0000-000000000000	7a5e9a91-d3bf-400c-a8ec-ad95d8641a82	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 03:32:01.589272+00	
00000000-0000-0000-0000-000000000000	788ab1c8-e2d4-4859-98a0-8153d870242d	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-29 03:32:13.306224+00	
00000000-0000-0000-0000-000000000000	d06c07f5-e499-4688-b920-86a68db99a13	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-29 04:39:50.342844+00	
00000000-0000-0000-0000-000000000000	93b79800-62a6-476b-828e-d3fdd725a58c	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-29 04:39:59.536959+00	
00000000-0000-0000-0000-000000000000	bd3e2f3d-5c48-4f89-bbc8-0dfa729118f0	{"action":"user_recovery_requested","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-29 04:40:07.185071+00	
00000000-0000-0000-0000-000000000000	982b7c88-8fac-4f67-ba5c-634daa1f4512	{"action":"user_recovery_requested","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-29 04:41:47.683017+00	
00000000-0000-0000-0000-000000000000	f0be6179-1aa8-432b-a291-913ec0372a26	{"action":"user_deleted","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"user_email":"govindsuthar.me@gmail.com","user_id":"6c054754-f4cf-413d-9386-abffd2c936da","user_phone":""}}	2025-08-29 04:43:50.757674+00	
00000000-0000-0000-0000-000000000000	67bbaad3-0787-4304-96f5-02e1bc9a155a	{"action":"user_deleted","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"user_email":"quizdangalbusiness@gmail.com","user_id":"8db8ad24-7a80-4c61-ab6e-524ac6b6a09a","user_phone":""}}	2025-08-29 04:43:50.795788+00	
00000000-0000-0000-0000-000000000000	502837cf-42b5-4a82-ad04-49e991eaf694	{"action":"user_deleted","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"user_email":"finprimebusiness@gmail.com","user_id":"4f149df7-36b3-498d-8c9a-8663b6cc35ee","user_phone":""}}	2025-08-29 04:43:50.805598+00	
00000000-0000-0000-0000-000000000000	8b98e732-21fc-492a-81fe-f0343676ac95	{"action":"user_deleted","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"user_email":"finprimebusinesses@gmail.com","user_id":"0cd6220c-611a-4fc2-9300-3c7b9f709d8f","user_phone":""}}	2025-08-29 04:43:50.80865+00	
00000000-0000-0000-0000-000000000000	f7e739b6-1e11-45de-ab64-300a6130123f	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-08-29 04:44:43.52013+00	
00000000-0000-0000-0000-000000000000	57c67014-2ea5-419f-9000-fe575d0b89c3	{"action":"user_signedup","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}	2025-08-29 04:46:33.027544+00	
00000000-0000-0000-0000-000000000000	71b9f91c-efb5-4368-876b-5d4e41b35449	{"action":"login","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-29 04:46:33.033003+00	
00000000-0000-0000-0000-000000000000	8c63eb5f-e29e-41ff-8a98-6fee370909cf	{"action":"logout","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-29 04:47:31.786987+00	
00000000-0000-0000-0000-000000000000	c9d94f33-9f4e-4f48-9185-57a95c988ad6	{"action":"user_recovery_requested","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-29 04:47:57.960181+00	
00000000-0000-0000-0000-000000000000	f5cc3022-fc43-4ed2-870b-0d739acba8bf	{"action":"login","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-29 04:48:21.614593+00	
00000000-0000-0000-0000-000000000000	692dd7b0-a208-4656-8ac9-adbb4c27838c	{"action":"user_recovery_requested","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-29 04:50:24.062996+00	
00000000-0000-0000-0000-000000000000	911e3d75-990c-4868-b750-d991afcb02fd	{"action":"user_recovery_requested","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-29 05:06:09.580696+00	
00000000-0000-0000-0000-000000000000	8f451cde-4c4f-405f-81ec-6b59e61e4017	{"action":"user_recovery_requested","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-29 05:25:10.815999+00	
00000000-0000-0000-0000-000000000000	bcf37637-a167-431e-9a91-e228236debda	{"action":"user_recovery_requested","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-29 05:52:30.4894+00	
00000000-0000-0000-0000-000000000000	0ba40521-9f23-4dc2-896f-f8fd728f2720	{"action":"user_recovery_requested","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-29 06:00:44.700472+00	
00000000-0000-0000-0000-000000000000	0a56ea5d-a5d5-48ce-b35c-318674c0e59d	{"action":"user_recovery_requested","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-29 06:13:09.532936+00	
00000000-0000-0000-0000-000000000000	4018c5df-6e2d-46e2-9016-32a707744ec8	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-29 06:13:33.98297+00	
00000000-0000-0000-0000-000000000000	33290a69-b70b-4204-b2d4-5db8515db1fc	{"action":"user_recovery_requested","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-29 06:23:40.449817+00	
00000000-0000-0000-0000-000000000000	dc482e56-7445-44a4-ba24-40e750a52d94	{"action":"login","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-29 06:25:22.380788+00	
00000000-0000-0000-0000-000000000000	46abde92-0e18-484c-b0e8-890623bd5509	{"action":"user_updated_password","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-29 06:25:48.042491+00	
00000000-0000-0000-0000-000000000000	58369efe-3e69-49f3-a683-2ab6b2486b87	{"action":"user_modified","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-29 06:25:48.04696+00	
00000000-0000-0000-0000-000000000000	8b49f179-5584-454a-9ca0-09b5e9406ca0	{"action":"logout","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-29 06:25:48.307629+00	
00000000-0000-0000-0000-000000000000	7573d1cd-9593-4bc2-8ed6-531a289b50bc	{"action":"login","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-29 06:26:15.230837+00	
00000000-0000-0000-0000-000000000000	f38603b9-3f6b-4e36-a775-35021d8bf067	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-29 06:37:45.25957+00	
00000000-0000-0000-0000-000000000000	e119f880-50fb-46de-97fe-4bc052db3365	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-29 07:18:00.874577+00	
00000000-0000-0000-0000-000000000000	9a782db6-fe88-4a10-9818-927fae19a0dd	{"action":"login","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-29 07:19:40.176676+00	
00000000-0000-0000-0000-000000000000	1ef948d5-8d0f-4386-986b-f825f8a17863	{"action":"user_recovery_requested","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-08-29 12:48:59.446034+00	
00000000-0000-0000-0000-000000000000	77881a8c-23f2-4944-bc8b-872cae392ee8	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-29 12:49:39.918044+00	
00000000-0000-0000-0000-000000000000	d6dd9ea2-57cb-45e9-98e2-2ac3c0e651ba	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-29 13:19:10.331169+00	
00000000-0000-0000-0000-000000000000	13f0cdc8-d3da-40a6-86e6-a359b8093001	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 13:49:57.724251+00	
00000000-0000-0000-0000-000000000000	c018bddc-e1fe-402d-aceb-5cbcc31faeab	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 13:49:57.735991+00	
00000000-0000-0000-0000-000000000000	d857a5d8-12db-4802-9831-8ffb18a5e6cc	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 15:32:34.727412+00	
00000000-0000-0000-0000-000000000000	6dec92f3-87f5-40dd-a963-ed5c54124fba	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 15:32:34.753053+00	
00000000-0000-0000-0000-000000000000	1b5ca66b-4e2a-42f1-9846-cfaf3afe359c	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-29 15:34:13.399947+00	
00000000-0000-0000-0000-000000000000	a596f6c2-e62d-4123-b8c2-47e42dc4bd52	{"action":"token_refreshed","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 15:45:40.122439+00	
00000000-0000-0000-0000-000000000000	39b4b6a7-db2b-4b7d-b9e7-38347fbf093e	{"action":"token_revoked","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 15:45:40.132601+00	
00000000-0000-0000-0000-000000000000	f9030b4a-26cc-49f5-a4e5-d97083e1d696	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-29 16:25:31.244085+00	
00000000-0000-0000-0000-000000000000	99b93d0f-fb05-4110-9d3c-044ea9b880d8	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 16:31:35.331107+00	
00000000-0000-0000-0000-000000000000	0250b782-96d8-45fc-8a75-b6a7aa008872	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 16:31:35.33938+00	
00000000-0000-0000-0000-000000000000	9a887ad2-7a08-428c-9338-90b7a4addd3b	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 16:33:35.358778+00	
00000000-0000-0000-0000-000000000000	85a63b15-86fe-4260-8628-d2d65cfd8aba	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 16:33:35.365311+00	
00000000-0000-0000-0000-000000000000	11f665f3-6d5b-4c04-8231-6d27a38cb0fe	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-29 16:38:04.320452+00	
00000000-0000-0000-0000-000000000000	7714d97b-6337-47fd-b64b-cd8234ed3682	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 17:30:35.05722+00	
00000000-0000-0000-0000-000000000000	0a4ec5dd-d810-4e1c-b715-9ffb997ee490	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 17:30:35.078386+00	
00000000-0000-0000-0000-000000000000	0312fae0-dec2-442d-b803-f584a91969de	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-29 17:35:28.552451+00	
00000000-0000-0000-0000-000000000000	316c7d28-9a14-47c8-bd76-0f2789a7efd9	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 17:36:15.127639+00	
00000000-0000-0000-0000-000000000000	702a55b6-323c-49fd-94d1-6816491ab07d	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 17:36:15.129282+00	
00000000-0000-0000-0000-000000000000	de4b55e8-32e3-4c23-90b6-08655ffd4983	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 18:29:35.237852+00	
00000000-0000-0000-0000-000000000000	b7541144-33e7-46c3-85f3-a79e6297e281	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 18:29:35.259867+00	
00000000-0000-0000-0000-000000000000	a9e6539d-73de-4e86-9c52-5737908a2e6b	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 18:34:47.268948+00	
00000000-0000-0000-0000-000000000000	de23beae-ff82-4873-9d54-7ed3441817df	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 18:34:47.273348+00	
00000000-0000-0000-0000-000000000000	19fa3dc6-95be-450f-ab22-35d2b0431182	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 18:35:12.904763+00	
00000000-0000-0000-0000-000000000000	20dc8c34-8ad9-49b5-b28c-17be8a602692	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 18:35:12.906589+00	
00000000-0000-0000-0000-000000000000	f904d467-7c00-4918-adbf-adfeae2f82a4	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 19:29:35.286982+00	
00000000-0000-0000-0000-000000000000	9674d24d-83b6-4563-8936-6df0f50ef7a8	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 19:29:35.299494+00	
00000000-0000-0000-0000-000000000000	3f9ecc0e-d822-4e70-85cb-7da4546603c4	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 19:33:35.11159+00	
00000000-0000-0000-0000-000000000000	6a828313-84db-4aa0-aee0-7ca99b9352ba	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 19:33:35.124939+00	
00000000-0000-0000-0000-000000000000	ff31b1f6-14a3-43a0-b3c9-758e0477ab03	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 19:39:16.669967+00	
00000000-0000-0000-0000-000000000000	8196afee-462a-485d-b7c4-f63539a316a6	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 19:39:16.677061+00	
00000000-0000-0000-0000-000000000000	54529255-dde0-4af8-a056-c53bcc0d70e0	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 19:46:17.7739+00	
00000000-0000-0000-0000-000000000000	1c4bfa31-c0c0-4874-8f69-ecd85288ccbf	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-29 19:46:17.782747+00	
00000000-0000-0000-0000-000000000000	23d8eb85-c8cd-4f0f-a2a9-03fe7b414eec	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-29 19:46:51.883772+00	
00000000-0000-0000-0000-000000000000	37015d88-332f-46c0-a118-9ad388b7b8bf	{"action":"login","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-29 20:14:12.722242+00	
00000000-0000-0000-0000-000000000000	2029bf74-9d9e-433a-ba05-be077b571ea7	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-29 20:20:27.430758+00	
00000000-0000-0000-0000-000000000000	4341534e-943e-495c-aa29-31703fb5f61f	{"action":"logout","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-29 20:21:57.148624+00	
00000000-0000-0000-0000-000000000000	8779c3a4-69cb-4449-8911-d0256e02c79c	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-30 04:48:23.776144+00	
00000000-0000-0000-0000-000000000000	a547ce62-bf5d-4e2d-a11e-b6804d732fa1	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-30 16:11:53.518882+00	
00000000-0000-0000-0000-000000000000	99ba19f6-5bbe-4fc3-94c2-abd17c571596	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-30 17:10:25.860545+00	
00000000-0000-0000-0000-000000000000	5e1e4d0a-0021-4a96-a5ba-6e00c9596abd	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-30 17:10:25.888739+00	
00000000-0000-0000-0000-000000000000	e96f9709-f610-4b28-b530-89512b92b807	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-30 17:15:47.155578+00	
00000000-0000-0000-0000-000000000000	944a0c5f-3811-4605-9738-46e8983f730d	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-30 17:53:44.726331+00	
00000000-0000-0000-0000-000000000000	8a711f13-c17a-4800-b04b-74cb46fd4f8c	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-30 18:01:12.73126+00	
00000000-0000-0000-0000-000000000000	f89a4ad0-9203-43d0-9f4a-867630ea4787	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-30 18:09:23.035011+00	
00000000-0000-0000-0000-000000000000	8c811c87-df35-41e0-9fe3-578f15e71cfd	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-30 18:09:23.042092+00	
00000000-0000-0000-0000-000000000000	3d3f8f78-58c5-4d67-8177-cc4aa889da6d	{"action":"login","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-30 18:18:24.700808+00	
00000000-0000-0000-0000-000000000000	5f990353-e5a7-4d63-bb59-39b2ac99c90c	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-30 18:59:04.392383+00	
00000000-0000-0000-0000-000000000000	a19d8316-7b36-4d2f-99fe-a1a5e1ba61d1	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-30 19:04:59.399023+00	
00000000-0000-0000-0000-000000000000	8efee110-73f5-40d9-86b4-c05ec8458ab3	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-08-30 19:04:59.410782+00	
00000000-0000-0000-0000-000000000000	4e231a32-1ce5-4f8e-8a34-d3b5eb31e82d	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-31 16:31:21.136789+00	
00000000-0000-0000-0000-000000000000	8cecf3ef-a5a6-467f-a598-802adf8d95d6	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-08-31 17:04:35.799708+00	
00000000-0000-0000-0000-000000000000	cccd93a9-cba2-4f67-8714-a9d874ed4ff9	{"action":"login","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-31 17:04:55.749412+00	
00000000-0000-0000-0000-000000000000	b68830f0-302d-46b5-9f01-307fd7a2d4ec	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-31 17:25:03.602644+00	
00000000-0000-0000-0000-000000000000	e011e1ce-ea3c-42c1-878c-fd047e76cc83	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-31 17:25:30.407879+00	
00000000-0000-0000-0000-000000000000	28cf6087-9737-4987-a9d5-7e0df59101ae	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-08-31 17:25:52.823398+00	
00000000-0000-0000-0000-000000000000	97876a8d-2eda-487a-b3b0-412fc0fbd981	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 02:19:31.920817+00	
00000000-0000-0000-0000-000000000000	bdbfb945-0911-42f5-949d-e6acbe226746	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 02:19:31.939481+00	
00000000-0000-0000-0000-000000000000	c8c44467-a231-4779-b1f9-75d2ead8bcbb	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-01 02:20:54.538862+00	
00000000-0000-0000-0000-000000000000	765db51f-3f06-4634-9dcf-5b3072256a6a	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-09-01 02:21:16.834461+00	
00000000-0000-0000-0000-000000000000	fb5fecfe-394f-40bf-8b95-0e2e0668ae3f	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-01 02:55:53.572474+00	
00000000-0000-0000-0000-000000000000	06f93a4a-6767-4323-ae0f-03c7c3f1e886	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 03:54:22.557562+00	
00000000-0000-0000-0000-000000000000	f0210930-e35e-4c09-a4b5-9b7bfb52c0ce	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 03:54:22.578498+00	
00000000-0000-0000-0000-000000000000	84b1e8a1-1c2e-46e8-b647-f8a619618d14	{"action":"token_refreshed","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 04:13:53.425002+00	
00000000-0000-0000-0000-000000000000	29e0d791-7259-4be7-a588-0b490ad51b98	{"action":"token_revoked","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 04:13:53.436849+00	
00000000-0000-0000-0000-000000000000	2ff228df-3e9c-4d49-8b1b-f7594b4139c8	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-01 04:14:32.825604+00	
00000000-0000-0000-0000-000000000000	70d9ca78-434a-49f3-8857-add3770706cf	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-01 04:17:18.924747+00	
00000000-0000-0000-0000-000000000000	824dc273-7249-4a60-9029-ed89e695b05b	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-01 04:25:51.881836+00	
00000000-0000-0000-0000-000000000000	019960fc-6b42-4dbf-83c1-4359d9a59eab	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-01 07:15:09.500643+00	
00000000-0000-0000-0000-000000000000	044c1961-80a0-4cd6-8723-9b3aa15cb1a5	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-01 07:40:39.502622+00	
00000000-0000-0000-0000-000000000000	d9ff372b-73fb-4bed-b7dc-2e21e61f3080	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-01 07:42:41.641372+00	
00000000-0000-0000-0000-000000000000	3a19cd55-79ae-4233-96e7-d54d8df80cfb	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-01 08:41:55.934853+00	
00000000-0000-0000-0000-000000000000	574a536d-5ab9-4f78-9b4f-3ddc4badeaa2	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-01 08:44:32.924582+00	
00000000-0000-0000-0000-000000000000	13bf740b-707b-472a-b7eb-42ef8acbd3a9	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 09:34:28.252672+00	
00000000-0000-0000-0000-000000000000	6a10ddf4-0d1b-493c-a369-e8812729dfa6	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 09:34:28.279669+00	
00000000-0000-0000-0000-000000000000	8140323f-5ce6-4286-ba34-172525ec57f3	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 09:35:35.085541+00	
00000000-0000-0000-0000-000000000000	72dc0b0b-6f3e-4b18-a70c-8f0ad0f13f3d	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 09:35:35.088289+00	
00000000-0000-0000-0000-000000000000	eff42fd8-180c-4b5c-b60c-e9c87d71b1f7	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-01 09:36:56.965835+00	
00000000-0000-0000-0000-000000000000	f1f42bd3-1888-417c-b91e-b5d369576573	{"action":"token_refreshed","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 10:06:05.959895+00	
00000000-0000-0000-0000-000000000000	9667ca39-5e52-4cc1-bce8-3c4f38fea132	{"action":"token_revoked","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 10:06:05.978186+00	
00000000-0000-0000-0000-000000000000	d042a63c-2ed8-4d81-98e5-96c16aed1777	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-01 10:06:38.964722+00	
00000000-0000-0000-0000-000000000000	b9bc62f2-acc9-4905-8e0c-632eaa61b1cb	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 10:32:57.705816+00	
00000000-0000-0000-0000-000000000000	eaee9ff9-4460-436e-9216-aa0b347c83c4	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 10:32:57.714911+00	
00000000-0000-0000-0000-000000000000	0fa3425b-c433-43c7-b7f8-998ca4116eb2	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 10:35:26.411205+00	
00000000-0000-0000-0000-000000000000	6bd7260d-b31c-4f97-8bad-917c74776bb4	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 10:35:26.414008+00	
00000000-0000-0000-0000-000000000000	ac196387-a062-4a69-b073-adfb7d30a96b	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 11:11:28.725874+00	
00000000-0000-0000-0000-000000000000	62114f7a-50b3-48e6-9bda-71782ef822df	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 11:11:28.749027+00	
00000000-0000-0000-0000-000000000000	5afc94b4-e638-460e-9392-4a043e87f7c1	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-01 11:13:44.250868+00	
00000000-0000-0000-0000-000000000000	4835087b-ebb2-4211-887e-935ccfe6775b	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 11:34:03.396394+00	
00000000-0000-0000-0000-000000000000	76c8c3ea-0ea6-45b1-a78c-fe43915d6a02	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 11:34:03.407706+00	
00000000-0000-0000-0000-000000000000	94b6a323-cece-4f39-9114-2a1c215baf46	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 12:09:57.399015+00	
00000000-0000-0000-0000-000000000000	b9d7b136-175b-4db1-ac19-90274c3aa825	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 12:09:57.413531+00	
00000000-0000-0000-0000-000000000000	5b524405-8e49-48a9-9b97-ff50cedb82aa	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 12:32:32.504214+00	
00000000-0000-0000-0000-000000000000	ab392331-d7a6-42c3-932e-064be23ae1f5	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 12:32:32.516311+00	
00000000-0000-0000-0000-000000000000	f4d4e20a-58c1-4945-98a4-e6c3ebf21510	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 12:43:41.97722+00	
00000000-0000-0000-0000-000000000000	59bf0156-72f7-40e1-a4fb-09ef955dbc2c	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 12:43:41.993495+00	
00000000-0000-0000-0000-000000000000	b08562fc-9a18-484e-bfe3-62b27dcb629d	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 12:46:16.651054+00	
00000000-0000-0000-0000-000000000000	b1861809-91c0-4a8b-b891-91827759639e	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 12:46:16.653906+00	
00000000-0000-0000-0000-000000000000	ff560da0-ce7c-44e1-b7c1-d34a38141308	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 13:00:57.459269+00	
00000000-0000-0000-0000-000000000000	199dce48-81fe-42ec-91a2-bc1a81945509	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 13:00:57.466749+00	
00000000-0000-0000-0000-000000000000	f74246ec-d08e-4407-8db7-d71106417d32	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 13:08:26.412179+00	
00000000-0000-0000-0000-000000000000	a66f0566-4dee-4e20-9887-09c029b8414d	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 13:08:26.416365+00	
00000000-0000-0000-0000-000000000000	514b4b30-4b52-4dfa-b9fd-31f3a623335c	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 14:09:39.227022+00	
00000000-0000-0000-0000-000000000000	f6e8b851-626e-4185-ab12-29b60d3676ab	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 14:09:39.251486+00	
00000000-0000-0000-0000-000000000000	2a616c63-50b4-4299-a189-8827112fbfbe	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 14:09:39.4306+00	
00000000-0000-0000-0000-000000000000	b461fc2f-3180-4308-97ed-16ef0dd83102	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 14:09:39.438105+00	
00000000-0000-0000-0000-000000000000	3b3caf29-aced-481d-a369-d1002928cd60	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 14:10:00.002471+00	
00000000-0000-0000-0000-000000000000	bfcdc24b-72d0-43c5-a0fa-50e1694f8dae	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 14:10:00.003166+00	
00000000-0000-0000-0000-000000000000	54efe6c4-6cf9-4f67-a900-68cb2aa97701	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 15:08:08.739469+00	
00000000-0000-0000-0000-000000000000	9d63d0ec-89dd-4c9d-af7d-4420b90b91bf	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 15:08:08.742644+00	
00000000-0000-0000-0000-000000000000	b9009dce-7d78-4176-bcc7-49346a6ec29f	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 15:08:08.750531+00	
00000000-0000-0000-0000-000000000000	0d54dc78-390e-41fb-8825-975ba613ef9e	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 15:08:08.750065+00	
00000000-0000-0000-0000-000000000000	9563062d-7ce9-4ad4-b226-11dd34cbd9c3	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 15:54:35.377923+00	
00000000-0000-0000-0000-000000000000	146329a4-289d-4a2e-a1ca-ddab0293aabe	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 15:54:35.394195+00	
00000000-0000-0000-0000-000000000000	ce54178d-a381-4694-b5c4-58077d0758d1	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 15:55:06.515989+00	
00000000-0000-0000-0000-000000000000	16890a93-651e-44d9-9f45-123e6555cf44	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 15:55:06.522325+00	
00000000-0000-0000-0000-000000000000	7c746b9d-477a-4d94-97f7-070770a90af7	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 16:06:44.520735+00	
00000000-0000-0000-0000-000000000000	46386d26-f68f-4ac2-a618-c05417662513	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 16:06:44.531801+00	
00000000-0000-0000-0000-000000000000	73d0569b-416a-46c6-bd22-7c204d1d09bf	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 16:07:03.285542+00	
00000000-0000-0000-0000-000000000000	b7125c59-6240-471d-902b-0482890dca1b	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 16:07:03.28625+00	
00000000-0000-0000-0000-000000000000	b81243f1-d340-40fb-ade9-bef1ec3f8482	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-01 16:56:47.65435+00	
00000000-0000-0000-0000-000000000000	1d8487c0-8c16-4267-a4a1-81941bf0bbcc	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 17:04:51.646833+00	
00000000-0000-0000-0000-000000000000	22678381-5b5c-4285-84ee-00778992e730	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 17:04:51.655974+00	
00000000-0000-0000-0000-000000000000	5eb95323-d9a1-4578-bd25-470ac0576e40	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-01 17:07:18.357457+00	
00000000-0000-0000-0000-000000000000	de6a9815-6158-4fc9-b585-fcbdc8a95d7d	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-09-01 17:07:30.315443+00	
00000000-0000-0000-0000-000000000000	feeedc1d-5316-4d8a-a166-4e651b280a54	{"action":"token_refreshed","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 18:15:05.5347+00	
00000000-0000-0000-0000-000000000000	cf8b3e95-4ed5-4b1b-9c46-62fb0a80c153	{"action":"token_revoked","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 18:15:05.562741+00	
00000000-0000-0000-0000-000000000000	99d30486-e342-49f8-b070-78b879525f14	{"action":"token_refreshed","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 22:18:32.324929+00	
00000000-0000-0000-0000-000000000000	fa30842d-8b85-4ac8-93f8-6612f2bc9e0a	{"action":"token_revoked","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-01 22:18:32.357681+00	
00000000-0000-0000-0000-000000000000	64d782f9-ea12-4b63-94f8-4826674dc530	{"action":"token_refreshed","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-02 02:38:03.627169+00	
00000000-0000-0000-0000-000000000000	eeca0872-c895-40ee-8c04-011269c6e31d	{"action":"token_revoked","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-02 02:38:03.661763+00	
00000000-0000-0000-0000-000000000000	8f012b79-8c08-4a73-80c7-781713785088	{"action":"token_refreshed","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-02 05:33:03.216843+00	
00000000-0000-0000-0000-000000000000	4ed8f74e-83ea-4744-8f87-69e01830044d	{"action":"token_revoked","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-02 05:33:03.241693+00	
00000000-0000-0000-0000-000000000000	d40a98b8-db09-4540-90d8-c415f768cd89	{"action":"token_refreshed","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-02 05:43:18.053977+00	
00000000-0000-0000-0000-000000000000	d3ee1ddf-7530-4d4c-bdd9-6b1cac2be4ed	{"action":"token_revoked","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-02 05:43:18.07667+00	
00000000-0000-0000-0000-000000000000	d6773f9a-1ef8-4491-8ec7-480670c05599	{"action":"token_refreshed","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-02 09:37:07.149942+00	
00000000-0000-0000-0000-000000000000	2dc32df0-4c11-43ba-a11a-cd7cefcedb01	{"action":"token_revoked","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-02 09:37:07.175225+00	
00000000-0000-0000-0000-000000000000	7c37ea0f-beae-412b-9c77-1016b518b92f	{"action":"token_refreshed","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-02 10:35:36.683299+00	
00000000-0000-0000-0000-000000000000	3a635514-928c-4742-9ce5-8bb55191ed0f	{"action":"token_revoked","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-02 10:35:36.698783+00	
00000000-0000-0000-0000-000000000000	e17494ab-a27a-46f5-8260-09731893abd5	{"action":"token_refreshed","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-02 10:35:37.455773+00	
00000000-0000-0000-0000-000000000000	450470dd-241d-4a41-a40c-71e837992eda	{"action":"token_refreshed","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-02 12:46:37.605736+00	
00000000-0000-0000-0000-000000000000	27124d0d-cab0-4999-a620-bcb1080e30ef	{"action":"token_revoked","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-02 12:46:37.636751+00	
00000000-0000-0000-0000-000000000000	67820cbf-6cb7-40a7-88ae-429ee0e18ebf	{"action":"token_refreshed","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-02 13:45:28.105904+00	
00000000-0000-0000-0000-000000000000	08d35299-7acc-4583-a52d-92cb571cea50	{"action":"token_revoked","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-02 13:45:28.119948+00	
00000000-0000-0000-0000-000000000000	9bc2ba38-5628-4cbc-bc9c-66fa89b01798	{"action":"token_refreshed","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-02 15:09:16.693507+00	
00000000-0000-0000-0000-000000000000	ed0cbc2c-d799-4241-a185-1e6965db6e53	{"action":"token_revoked","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-02 15:09:16.723576+00	
00000000-0000-0000-0000-000000000000	574481cf-7ccc-43f1-8558-81fba8bf87ec	{"action":"logout","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-02 15:09:23.630613+00	
00000000-0000-0000-0000-000000000000	a24047f6-0abc-4259-adc0-df7269b8461a	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-03 02:29:45.550673+00	
00000000-0000-0000-0000-000000000000	ae117962-322a-425a-b340-7ee0adeb16e5	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-03 04:44:06.988162+00	
00000000-0000-0000-0000-000000000000	f4b552f7-33d1-4893-a970-e256651296a8	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-03 04:44:07.019144+00	
00000000-0000-0000-0000-000000000000	cbfcc0a7-c345-49a1-ad41-3a8b6f080610	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-03 05:43:33.628328+00	
00000000-0000-0000-0000-000000000000	35d698ae-761b-42a6-a8d1-2bb4ad1648c2	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-03 05:43:33.64552+00	
00000000-0000-0000-0000-000000000000	ca5db98d-c9ad-4805-aec6-3df50d4c079b	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-03 06:19:06.458697+00	
00000000-0000-0000-0000-000000000000	7773abdc-dbaa-4c45-85f7-2f9e0efe34c8	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-03 14:41:10.845629+00	
00000000-0000-0000-0000-000000000000	3e1ca982-3b63-4903-ae61-183e59a7c436	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-03 14:41:10.864771+00	
00000000-0000-0000-0000-000000000000	d664064d-d0f4-4e52-9b38-c1711b742237	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-03 14:41:20.279105+00	
00000000-0000-0000-0000-000000000000	922985df-98a1-4b94-bef1-9979c7b3f192	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-04 05:49:15.517269+00	
00000000-0000-0000-0000-000000000000	b904c98e-ee83-4afb-91aa-f7b7ffccc9d9	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-04 06:01:48.865066+00	
00000000-0000-0000-0000-000000000000	a3c02e26-c3fc-47e4-bebf-c244772ce12b	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-04 06:13:26.290695+00	
00000000-0000-0000-0000-000000000000	abeb60b9-3c97-4a2a-90e8-834071bd42a1	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-04 08:55:06.529465+00	
00000000-0000-0000-0000-000000000000	7bb8491a-a4ff-4f5b-a582-6378f169e28b	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-04 08:55:06.562524+00	
00000000-0000-0000-0000-000000000000	7cfb598f-6454-43d6-8d19-9aa7b1be51c3	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-04 09:13:21.820636+00	
00000000-0000-0000-0000-000000000000	ad300d88-6193-47cd-a8a7-1492d07c5717	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-04 09:13:21.836965+00	
00000000-0000-0000-0000-000000000000	afdbb6b6-efeb-429b-98f3-622380627a28	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-04 09:26:59.475408+00	
00000000-0000-0000-0000-000000000000	8314b497-c242-4e36-bcfa-b02267a3b2c2	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-04 09:26:59.484865+00	
00000000-0000-0000-0000-000000000000	46c7be7c-bd9f-4673-8ec1-a95597b4a47f	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-04 10:25:41.476061+00	
00000000-0000-0000-0000-000000000000	ae635e3c-977a-4d38-bb87-84b675888646	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-04 10:25:41.48935+00	
00000000-0000-0000-0000-000000000000	692de1d1-d5e6-4433-9934-91f07eb94240	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-04 10:53:12.372199+00	
00000000-0000-0000-0000-000000000000	fa58031c-0bb6-4b2c-9518-f0eec5a46b3f	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-04 11:24:41.173264+00	
00000000-0000-0000-0000-000000000000	72244717-beaa-4d42-aa4f-2b0966933d36	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-04 11:24:41.188541+00	
00000000-0000-0000-0000-000000000000	841ccf62-5b86-4e36-ae86-b09e6d1742a0	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-04 11:34:39.013408+00	
00000000-0000-0000-0000-000000000000	c1c80a38-0d1e-41d9-8569-ccc92fef7ab9	{"action":"login","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-04 11:35:04.325998+00	
00000000-0000-0000-0000-000000000000	7667c122-972d-4441-a148-c0d3efa0a4da	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-04 12:11:35.614498+00	
00000000-0000-0000-0000-000000000000	1abea14f-d514-48e9-97f3-9cd696281701	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-04 12:12:34.412592+00	
00000000-0000-0000-0000-000000000000	2cca43ac-73da-4c3b-9880-0cbe8dca925b	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-04 12:15:08.506844+00	
00000000-0000-0000-0000-000000000000	a0be38a2-b5ab-4a4b-bd5e-a04272bae1a8	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-04 12:20:07.35344+00	
00000000-0000-0000-0000-000000000000	a69d86cf-ea4d-4f8c-b774-cbceab261411	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-04 12:21:03.685174+00	
00000000-0000-0000-0000-000000000000	49f785c8-0acb-4098-b85a-f28bf8179789	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-04 12:21:24.446642+00	
00000000-0000-0000-0000-000000000000	c5da98d3-26b3-4150-a7ec-e02e0dc1158e	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-04 12:23:29.92374+00	
00000000-0000-0000-0000-000000000000	f9591ee8-7be1-4a35-b55a-846978b9fde1	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-04 12:23:47.223005+00	
00000000-0000-0000-0000-000000000000	8dcdc718-37f2-49a3-978f-2ed1eb22d318	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-04 13:39:31.922796+00	
00000000-0000-0000-0000-000000000000	a6e683d2-7fca-4db6-800b-40eee5ca817b	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-04 13:39:31.947911+00	
00000000-0000-0000-0000-000000000000	78dd03c7-82cd-45a4-ba7f-7c5e43744998	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-04 13:39:32.815979+00	
00000000-0000-0000-0000-000000000000	b282d110-2d28-459c-a0e2-7d695fab214b	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-04 13:45:08.486089+00	
00000000-0000-0000-0000-000000000000	cf7e1369-98b0-4a6f-8148-3765a6e11b1e	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-09-04 14:44:56.318866+00	
00000000-0000-0000-0000-000000000000	d47f94ac-02ab-46b5-bbdc-239742338635	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-09-04 14:46:27.769861+00	
00000000-0000-0000-0000-000000000000	3eaf418b-fefe-465e-a8b2-15e032c3d5bf	{"action":"logout","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-04 14:58:13.434373+00	
00000000-0000-0000-0000-000000000000	8a2c7c94-43da-44b2-8c1a-657e3b02a10e	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-04 15:16:16.218687+00	
00000000-0000-0000-0000-000000000000	fec42c9b-3e0a-4d74-a54d-40119e7994f1	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-04 15:16:31.274748+00	
00000000-0000-0000-0000-000000000000	2110380d-5e55-4fc1-8898-d919f2b169b1	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-09-04 15:16:44.659282+00	
00000000-0000-0000-0000-000000000000	aa0dbd86-a16c-42b4-85e6-420e3e741b46	{"action":"logout","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-04 16:08:39.465144+00	
00000000-0000-0000-0000-000000000000	75aef62b-9e28-44a6-81c7-939d57d1191d	{"action":"login","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-04 16:08:52.689804+00	
00000000-0000-0000-0000-000000000000	ceb7940d-4b04-4e7f-b1e8-1bde5dbca06b	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-04 23:13:04.09424+00	
00000000-0000-0000-0000-000000000000	12986016-93d5-4131-b7e9-693c46e0b020	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-04 23:13:24.927019+00	
00000000-0000-0000-0000-000000000000	691ed9f5-77dc-43cd-890d-e8992ff58278	{"action":"login","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-04 23:29:14.415418+00	
00000000-0000-0000-0000-000000000000	a449d587-84c0-4816-99f6-23bfe6ea85cd	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-04 23:44:59.071613+00	
00000000-0000-0000-0000-000000000000	ed75d727-d811-45f4-80cd-700a108bff7a	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-05 00:05:39.797297+00	
00000000-0000-0000-0000-000000000000	e22a463d-9cab-4887-973b-732b58b07831	{"action":"login","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-05 00:06:06.771792+00	
00000000-0000-0000-0000-000000000000	88b9f1cc-e796-4db1-8f78-e2cca0d4754b	{"action":"logout","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-05 00:41:01.210433+00	
00000000-0000-0000-0000-000000000000	454b0497-5bc4-4747-b51e-8fbf6be765f3	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-05 00:41:12.795322+00	
00000000-0000-0000-0000-000000000000	13d72993-8deb-4212-a07f-d8b7e9131040	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-05 00:44:40.821272+00	
00000000-0000-0000-0000-000000000000	20bb0581-21a9-4703-92dc-4cd7cba281dd	{"action":"login","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-05 00:44:53.058016+00	
00000000-0000-0000-0000-000000000000	4ac46cce-5ca4-4516-b8b4-a61d0e3e30d0	{"action":"logout","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-05 00:45:13.201129+00	
00000000-0000-0000-0000-000000000000	39810948-c06a-4976-9a09-e09b72626b4a	{"action":"login","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"google"}}	2025-09-05 00:46:00.000454+00	
00000000-0000-0000-0000-000000000000	058d220d-25e1-462a-8f16-f68d94303bee	{"action":"user_signedup","actor_id":"2ff275bd-7b73-4ff7-8a3d-d6a49b57259e","actor_name":"Kartik Suthar","actor_username":"kartiksuthar295@gmail.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"google"}}	2025-09-05 12:16:23.277876+00	
00000000-0000-0000-0000-000000000000	db8f2826-6bd3-4f80-9bdf-2fd208111ab0	{"action":"token_refreshed","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-05 15:26:43.56967+00	
00000000-0000-0000-0000-000000000000	c3ac1b68-66bd-49dd-81bc-e590ad8f31ea	{"action":"token_revoked","actor_id":"c9bac630-48da-42ef-b8ca-68797ed6d652","actor_name":"Govind","actor_username":"quizdangalofficial@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-05 15:26:43.583993+00	
00000000-0000-0000-0000-000000000000	7262b149-3706-42b4-9dbc-1cb19cc2619e	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-05 15:30:24.366192+00	
00000000-0000-0000-0000-000000000000	3bf45653-6505-480c-b7d5-658bafd17e67	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-05 15:31:52.978032+00	
00000000-0000-0000-0000-000000000000	0bea6aa9-f0d8-4ac2-ba18-e8e1b1a5f513	{"action":"login","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-05 15:32:10.307972+00	
00000000-0000-0000-0000-000000000000	ec4fbb90-adc6-4228-83f5-7db2e1f01f1d	{"action":"token_refreshed","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-05 16:31:26.897105+00	
00000000-0000-0000-0000-000000000000	df523023-dcec-4265-922f-0bf3d0f8d44b	{"action":"token_revoked","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-05 16:31:26.92378+00	
00000000-0000-0000-0000-000000000000	8ec7ef46-c87c-4372-a28e-7e794470d1f1	{"action":"login","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-05 17:18:26.668691+00	
00000000-0000-0000-0000-000000000000	8217696f-81b6-498b-9f44-838bd0f9b032	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-05 17:20:03.909647+00	
00000000-0000-0000-0000-000000000000	3eb8c4e8-030c-4e2b-a63e-85b24ae979c4	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-05 17:20:15.719122+00	
00000000-0000-0000-0000-000000000000	68b9dc14-6d97-4419-b888-5fdb3e8329d1	{"action":"login","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-05 17:20:28.816939+00	
00000000-0000-0000-0000-000000000000	f932662d-e7c9-481a-918d-9f65ab206712	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-05 17:29:24.51026+00	
00000000-0000-0000-0000-000000000000	762f09ef-4d3e-41f7-80f9-182441fea6ce	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-05 19:42:04.272199+00	
00000000-0000-0000-0000-000000000000	36917802-e40d-4a6e-b393-fcb96072a063	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-05 20:02:59.915905+00	
00000000-0000-0000-0000-000000000000	8daa62fb-8951-437f-b08d-ce47a2494a14	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-05 20:17:58.197924+00	
00000000-0000-0000-0000-000000000000	3e372a41-b1eb-4a46-8973-0b087ee440a5	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-05 21:17:26.375748+00	
00000000-0000-0000-0000-000000000000	297ba454-a1a5-4fba-8f2a-e2adc67b1a29	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-05 21:17:26.394622+00	
00000000-0000-0000-0000-000000000000	83cead88-ea1f-4cca-bfde-8f46830912e2	{"action":"token_refreshed","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-08 18:18:37.274316+00	
00000000-0000-0000-0000-000000000000	acbe6331-dbfa-4d8f-8b2d-67f2b980aeb8	{"action":"token_revoked","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-08 18:18:37.282868+00	
00000000-0000-0000-0000-000000000000	0044c18b-fbcd-4f5a-9229-93878d78ce8e	{"action":"logout","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-08 18:18:48.214198+00	
00000000-0000-0000-0000-000000000000	4b81df67-7b46-4d8f-8e17-a674d695e024	{"action":"login","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-08 19:02:48.094745+00	
00000000-0000-0000-0000-000000000000	8beeecb3-2a1b-4000-94ee-dc69b5114676	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-08 19:06:40.423198+00	
00000000-0000-0000-0000-000000000000	c8f2eb0b-b6f9-468d-b600-5cd6630e9b87	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-08 19:41:32.711207+00	
00000000-0000-0000-0000-000000000000	18624988-e4cc-44e2-9860-87ac45429ac0	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-08 19:42:09.160428+00	
00000000-0000-0000-0000-000000000000	e4b1cdce-c017-4cee-80ba-a9886ab5e40d	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-09 15:19:49.161492+00	
00000000-0000-0000-0000-000000000000	af65cbcd-5398-4f47-8ac4-0a38f9b65016	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-09 16:01:11.310479+00	
00000000-0000-0000-0000-000000000000	5fec3062-4d4a-4fc4-81a8-c0cacb0830b2	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-09 16:06:40.544032+00	
00000000-0000-0000-0000-000000000000	ded047b6-bc28-4bc7-9bd1-dd0d772e46bb	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-09 17:00:33.097631+00	
00000000-0000-0000-0000-000000000000	bbb2a06c-e404-465e-b8ba-ccdd9885689a	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-09 17:00:33.120851+00	
00000000-0000-0000-0000-000000000000	34022b05-d0d8-4030-9681-e78c18a3ce6b	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-09 17:05:27.30904+00	
00000000-0000-0000-0000-000000000000	9b2a3a43-4341-4fa3-81f5-cba034b32416	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-09 17:05:27.315728+00	
00000000-0000-0000-0000-000000000000	c611b83b-fff5-4414-92b6-c4b37cb93fe1	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-09 17:59:33.089418+00	
00000000-0000-0000-0000-000000000000	a06d38e1-be96-4374-b88e-223e468121fa	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-09 17:59:33.105598+00	
00000000-0000-0000-0000-000000000000	35413260-9ad0-4cb6-9872-552bf20971f4	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-09 18:04:33.23754+00	
00000000-0000-0000-0000-000000000000	fed953b3-c41b-4894-a383-5cb1564e2aeb	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-09 18:04:33.253363+00	
00000000-0000-0000-0000-000000000000	decf7396-7c10-4f79-85d0-4d926ccfbf66	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-10 03:55:47.557088+00	
00000000-0000-0000-0000-000000000000	00908afc-dc87-423f-854c-d65b8155a644	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-10 05:03:00.687889+00	
00000000-0000-0000-0000-000000000000	f6925930-6697-49ae-94d1-3e60979e7bae	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-10 05:03:00.708329+00	
00000000-0000-0000-0000-000000000000	b50c956a-8eb8-43f1-8b0c-c3676f99f148	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-10 06:01:30.908852+00	
00000000-0000-0000-0000-000000000000	11e48361-40c6-4cd0-8242-b0584b9dde26	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-10 06:01:30.920282+00	
00000000-0000-0000-0000-000000000000	fe735a50-e01e-44e9-9fa8-240b07f2ec5b	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-10 07:54:31.343538+00	
00000000-0000-0000-0000-000000000000	13305c16-df00-4a8e-befa-6e4a8441d93c	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-10 07:54:31.368072+00	
00000000-0000-0000-0000-000000000000	c2561f13-ca15-4d43-a12a-21105fde002c	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-10 08:53:20.980911+00	
00000000-0000-0000-0000-000000000000	66c261a1-1f73-4cdd-b6e7-902019d76954	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-10 08:53:20.996562+00	
00000000-0000-0000-0000-000000000000	5c2e182a-10df-4555-b2fa-14ee0d30b84d	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-10 09:08:27.978718+00	
00000000-0000-0000-0000-000000000000	2d680383-e117-49f3-a677-9829a2de010c	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-10 15:30:33.533589+00	
00000000-0000-0000-0000-000000000000	51b5ee90-11b9-4dc4-89fb-a108433619d8	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-10 15:30:33.559566+00	
00000000-0000-0000-0000-000000000000	eba7905c-f196-46c5-a056-4aee11613512	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-10 15:37:57.049143+00	
00000000-0000-0000-0000-000000000000	d2ca8dd6-7574-484b-9d5a-26a98a582a13	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-10 15:37:57.062264+00	
00000000-0000-0000-0000-000000000000	c78f5ed1-026c-4109-b1b9-6ddd5100189f	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-10 16:38:34.444983+00	
00000000-0000-0000-0000-000000000000	49617d3b-e38f-4e4c-ba62-1a869ede7026	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-10 16:38:34.463341+00	
00000000-0000-0000-0000-000000000000	c8500517-9bb9-43ae-b3cd-c8cf5e5eb400	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-10 17:05:05.834627+00	
00000000-0000-0000-0000-000000000000	0904cf71-84ca-4393-9074-02b003231d36	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-11 03:07:24.589738+00	
00000000-0000-0000-0000-000000000000	a1762dd1-23ce-4cb5-ba47-da9b81d8f442	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-11 03:51:30.488021+00	
00000000-0000-0000-0000-000000000000	acca4bbb-f419-4995-b5e2-b042891f7b1b	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-11 03:51:30.501417+00	
00000000-0000-0000-0000-000000000000	918c2481-3b07-495d-8be8-86054b03b303	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-11 04:08:18.796834+00	
00000000-0000-0000-0000-000000000000	520e6a64-4e52-4efd-ae14-63426a32c9b5	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-11 04:08:18.81112+00	
00000000-0000-0000-0000-000000000000	e3721c9c-ce57-4de0-81c4-169e271c186b	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-11 04:50:36.29988+00	
00000000-0000-0000-0000-000000000000	8b2670ac-2a7a-462b-a8bf-7a653e0b494b	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-11 04:50:36.318249+00	
00000000-0000-0000-0000-000000000000	35cb62e2-f4bb-4281-84af-12d4b9ca33a7	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-11 05:00:05.03665+00	
00000000-0000-0000-0000-000000000000	ad2e27e2-177d-48c3-b10d-e653910d9411	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-11 06:36:44.740399+00	
00000000-0000-0000-0000-000000000000	1be711f8-0cc2-4c1c-8644-26eec30c0e38	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-11 06:38:04.161755+00	
00000000-0000-0000-0000-000000000000	7bd0ea13-0e3f-410b-958a-c1aa3d9806bd	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-11 06:56:39.639803+00	
00000000-0000-0000-0000-000000000000	a5c88f92-2528-4cfe-8914-7a5ae7ee66de	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-11 07:06:43.287163+00	
00000000-0000-0000-0000-000000000000	7acb3b76-e3df-4253-9db8-e1464d9bfff8	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-11 07:24:57.175037+00	
00000000-0000-0000-0000-000000000000	cc8e4403-7485-48ff-8b31-cdb2b8a52cdf	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-11 07:26:25.010443+00	
00000000-0000-0000-0000-000000000000	88582579-f1a1-4d0f-972a-0d2028fdd718	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-11 07:43:53.744401+00	
00000000-0000-0000-0000-000000000000	be4b0f9a-9c27-4b89-8d7d-d2ddec54b5c8	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-11 08:23:46.973342+00	
00000000-0000-0000-0000-000000000000	b9ecbb36-f414-4411-8aaa-ab5df0822fb4	{"action":"login","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-11 08:25:43.719169+00	
00000000-0000-0000-0000-000000000000	845cee38-88b0-4326-a95c-004d6ad9361e	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-11 09:16:07.248766+00	
00000000-0000-0000-0000-000000000000	976cec15-35ad-41c3-8c07-330bd40ddaf9	{"action":"token_refreshed","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-11 09:24:08.683141+00	
00000000-0000-0000-0000-000000000000	40e3bf45-1d5c-4858-91f0-ff1970166e5a	{"action":"token_revoked","actor_id":"0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf","actor_username":"finprimebusiness@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-11 09:24:08.688789+00	
00000000-0000-0000-0000-000000000000	97a350d9-cf84-4b7b-9f37-26d539c007f2	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-11 09:54:19.528261+00	
00000000-0000-0000-0000-000000000000	5a7d648b-3351-4b90-939a-e06482834c9e	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-11 09:55:37.592057+00	
00000000-0000-0000-0000-000000000000	bb907e5c-6650-4139-9782-eaf3a70ff932	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-11 10:02:22.127354+00	
00000000-0000-0000-0000-000000000000	b182be45-04cd-4ca4-abb2-846e64fe7abd	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-11 10:03:50.022857+00	
00000000-0000-0000-0000-000000000000	01d79267-a6bc-4115-a5a3-d0e68b4025da	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-11 10:05:56.453419+00	
00000000-0000-0000-0000-000000000000	aa281338-4776-4cb7-b7b5-033696d78008	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-11 10:31:26.515104+00	
00000000-0000-0000-0000-000000000000	f90ac023-ab41-41c7-b146-7d653e056c6e	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-11 10:31:26.528413+00	
00000000-0000-0000-0000-000000000000	6473c4bc-aca9-43c0-8419-a2c858aedb11	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-11 11:30:28.175763+00	
00000000-0000-0000-0000-000000000000	8e7ef2e8-0851-4999-b8ef-af06d2b9a489	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-11 11:30:28.20077+00	
00000000-0000-0000-0000-000000000000	e79227ad-fc54-48d4-9d49-b7cca70cacd3	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-11 11:45:22.33031+00	
00000000-0000-0000-0000-000000000000	bc5d24e2-ea2f-43a9-8702-9b3d32fb368f	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-11 11:45:22.342717+00	
00000000-0000-0000-0000-000000000000	4023ef29-e912-4a9f-a0ca-d3ca5a390a2e	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-11 12:10:05.2854+00	
00000000-0000-0000-0000-000000000000	5efd1a84-31e0-423b-90df-51ec6c613d41	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-11 12:23:42.487495+00	
00000000-0000-0000-0000-000000000000	63f489b4-8240-4843-8573-772ec0aa3c3f	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-11 12:23:42.506874+00	
00000000-0000-0000-0000-000000000000	dcede5ff-376b-4ab1-8116-ae6e3a4e0789	{"action":"logout","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-09-11 12:38:46.496905+00	
00000000-0000-0000-0000-000000000000	ae90f739-2d1c-40f9-ab66-4aa523992835	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-11 15:40:13.174323+00	
00000000-0000-0000-0000-000000000000	c2222aab-9817-4895-98d1-829b73b8f186	{"action":"token_refreshed","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-11 17:23:15.20239+00	
00000000-0000-0000-0000-000000000000	c9f6b8b3-19a9-47f7-beda-9f6c9004cdb7	{"action":"token_revoked","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-09-11 17:23:15.2333+00	
00000000-0000-0000-0000-000000000000	3d7b0e46-09e1-489d-92bf-f1fee82e3795	{"action":"login","actor_id":"d54f5f83-aa63-4630-b9be-dbdca91b9315","actor_name":"Govind","actor_username":"sutharji1122@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-09-12 01:22:33.865803+00	
\.


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.flow_state (id, user_id, auth_code, code_challenge_method, code_challenge, provider_type, provider_access_token, provider_refresh_token, created_at, updated_at, authentication_method, auth_code_issued_at) FROM stdin;
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id) FROM stdin;
d54f5f83-aa63-4630-b9be-dbdca91b9315	d54f5f83-aa63-4630-b9be-dbdca91b9315	{"sub": "d54f5f83-aa63-4630-b9be-dbdca91b9315", "email": "sutharji1122@gmail.com", "email_verified": false, "phone_verified": false}	email	2025-08-23 14:49:34.823893+00	2025-08-23 14:49:34.825125+00	2025-08-23 14:49:34.825125+00	db265d68-0ac6-4d63-8ffa-0123ea3acc67
106847980397139222112	c9bac630-48da-42ef-b8ca-68797ed6d652	{"iss": "https://accounts.google.com", "sub": "106847980397139222112", "name": "Govind", "email": "quizdangalofficial@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocKq00BwNSRBkOGLU04snbVIgYuuXZ_9GF1efcMkou8bac9y3xM=s96-c", "full_name": "Govind", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocKq00BwNSRBkOGLU04snbVIgYuuXZ_9GF1efcMkou8bac9y3xM=s96-c", "provider_id": "106847980397139222112", "email_verified": true, "phone_verified": false}	google	2025-08-16 14:53:28.468228+00	2025-08-16 14:53:28.468288+00	2025-09-05 00:45:59.992739+00	54be6453-0f76-4122-88d7-cd7182fe47aa
118002990807929691971	d54f5f83-aa63-4630-b9be-dbdca91b9315	{"iss": "https://accounts.google.com", "sub": "118002990807929691971", "name": "Govind", "email": "sutharji1122@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIQKyDRHmvc2KvzlvpD3URLqVHjjxPTsl1pkuGfpieEsXdzejo=s96-c", "full_name": "Govind", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIQKyDRHmvc2KvzlvpD3URLqVHjjxPTsl1pkuGfpieEsXdzejo=s96-c", "provider_id": "118002990807929691971", "email_verified": true, "phone_verified": false}	google	2025-08-24 11:19:23.774505+00	2025-08-24 11:19:23.77458+00	2025-08-29 04:44:43.510826+00	2f5a731c-274b-4842-ab4c-84e1a83f0265
0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf	0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf	{"sub": "0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf", "email": "finprimebusiness@gmail.com", "email_verified": false, "phone_verified": false}	email	2025-08-29 04:46:33.015445+00	2025-08-29 04:46:33.015495+00	2025-08-29 04:46:33.015495+00	86208ba1-a721-407b-b552-4fe2640c2aa2
100088628231141428287	2ff275bd-7b73-4ff7-8a3d-d6a49b57259e	{"iss": "https://accounts.google.com", "sub": "100088628231141428287", "name": "Kartik Suthar", "email": "kartiksuthar295@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIjO1CXFc57Ud73jnAQkwKluXSE1NMGronNr-8iAABL-LXqUA=s96-c", "full_name": "Kartik Suthar", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIjO1CXFc57Ud73jnAQkwKluXSE1NMGronNr-8iAABL-LXqUA=s96-c", "provider_id": "100088628231141428287", "email_verified": true, "phone_verified": false}	google	2025-09-05 12:16:23.254616+00	2025-09-05 12:16:23.25583+00	2025-09-05 12:16:23.25583+00	9e042ff0-c80a-491c-8531-38744db014df
\.


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.instances (id, uuid, raw_base_config, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.mfa_amr_claims (session_id, created_at, updated_at, authentication_method, id) FROM stdin;
2370cc16-6ee1-4c32-b3f3-b83659b18cbc	2025-09-05 12:16:23.376083+00	2025-09-05 12:16:23.376083+00	oauth	94040ced-8ed5-4bbf-ae4a-3ea0d40a1168
799cea78-dde3-4786-b0e6-30c31754917d	2025-09-08 19:02:48.181297+00	2025-09-08 19:02:48.181297+00	password	34f60545-ab48-4556-99ef-13a3ebc14282
0adbcf32-d711-4a22-9274-d4bb5c54c707	2025-09-11 08:25:43.799334+00	2025-09-11 08:25:43.799334+00	password	7f70687c-5658-478f-afe3-a936d9f12054
06bd1c1e-f5b3-4a13-b37e-1436c665f59d	2025-09-11 15:40:13.29052+00	2025-09-11 15:40:13.29052+00	password	f07d9e84-3493-486e-85f2-144f31dbe2d5
5ce64711-3bb1-4a4a-9f83-f3b34da964d4	2025-09-12 01:22:33.945318+00	2025-09-12 01:22:33.945318+00	password	b86ce72e-1444-420f-b98a-39b626b64a75
1bd299a0-a1a8-44ea-b971-91d4572c9252	2025-09-05 00:46:00.005966+00	2025-09-05 00:46:00.005966+00	oauth	3708240c-beb7-46cc-91e7-b0388eec5dcc
\.


--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.mfa_challenges (id, factor_id, created_at, verified_at, ip_address, otp_code, web_authn_session_data) FROM stdin;
\.


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret, phone, last_challenged_at, web_authn_credential, web_authn_aaguid) FROM stdin;
\.


--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.oauth_clients (id, client_id, client_secret_hash, registration_type, redirect_uris, grant_types, client_name, client_uri, logo_uri, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.one_time_tokens (id, user_id, token_type, token_hash, relates_to, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) FROM stdin;
00000000-0000-0000-0000-000000000000	373	pbgxju3k2gzs	0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf	t	2025-09-11 08:25:43.757858+00	2025-09-11 09:24:08.692174+00	\N	0adbcf32-d711-4a22-9274-d4bb5c54c707
00000000-0000-0000-0000-000000000000	375	x54fc2kesvia	0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf	f	2025-09-11 09:24:08.694989+00	2025-09-11 09:24:08.694989+00	pbgxju3k2gzs	0adbcf32-d711-4a22-9274-d4bb5c54c707
00000000-0000-0000-0000-000000000000	328	whfnnxytwna2	2ff275bd-7b73-4ff7-8a3d-d6a49b57259e	f	2025-09-05 12:16:23.345076+00	2025-09-05 12:16:23.345076+00	\N	2370cc16-6ee1-4c32-b3f3-b83659b18cbc
00000000-0000-0000-0000-000000000000	327	nilpab7q6v2y	c9bac630-48da-42ef-b8ca-68797ed6d652	t	2025-09-05 00:46:00.003469+00	2025-09-05 15:26:43.585325+00	\N	1bd299a0-a1a8-44ea-b971-91d4572c9252
00000000-0000-0000-0000-000000000000	329	eiu6igguidhl	c9bac630-48da-42ef-b8ca-68797ed6d652	f	2025-09-05 15:26:43.599871+00	2025-09-05 15:26:43.599871+00	nilpab7q6v2y	1bd299a0-a1a8-44ea-b971-91d4572c9252
00000000-0000-0000-0000-000000000000	386	2nferiobxv5h	d54f5f83-aa63-4630-b9be-dbdca91b9315	t	2025-09-11 15:40:13.235585+00	2025-09-11 17:23:15.236733+00	\N	06bd1c1e-f5b3-4a13-b37e-1436c665f59d
00000000-0000-0000-0000-000000000000	387	fhp7tr6kjaxh	d54f5f83-aa63-4630-b9be-dbdca91b9315	f	2025-09-11 17:23:15.264188+00	2025-09-11 17:23:15.264188+00	2nferiobxv5h	06bd1c1e-f5b3-4a13-b37e-1436c665f59d
00000000-0000-0000-0000-000000000000	388	xrflcxxdjdcb	d54f5f83-aa63-4630-b9be-dbdca91b9315	f	2025-09-12 01:22:33.915693+00	2025-09-12 01:22:33.915693+00	\N	5ce64711-3bb1-4a4a-9f83-f3b34da964d4
00000000-0000-0000-0000-000000000000	342	xzg6ecrcvdxr	0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf	f	2025-09-08 19:02:48.138082+00	2025-09-08 19:02:48.138082+00	\N	799cea78-dde3-4786-b0e6-30c31754917d
\.


--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.saml_providers (id, sso_provider_id, entity_id, metadata_xml, metadata_url, attribute_mapping, created_at, updated_at, name_id_format) FROM stdin;
\.


--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.saml_relay_states (id, sso_provider_id, request_id, for_email, redirect_to, created_at, updated_at, flow_state_id) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.schema_migrations (version) FROM stdin;
20171026211738
20171026211808
20171026211834
20180103212743
20180108183307
20180119214651
20180125194653
00
20210710035447
20210722035447
20210730183235
20210909172000
20210927181326
20211122151130
20211124214934
20211202183645
20220114185221
20220114185340
20220224000811
20220323170000
20220429102000
20220531120530
20220614074223
20220811173540
20221003041349
20221003041400
20221011041400
20221020193600
20221021073300
20221021082433
20221027105023
20221114143122
20221114143410
20221125140132
20221208132122
20221215195500
20221215195800
20221215195900
20230116124310
20230116124412
20230131181311
20230322519590
20230402418590
20230411005111
20230508135423
20230523124323
20230818113222
20230914180801
20231027141322
20231114161723
20231117164230
20240115144230
20240214120130
20240306115329
20240314092811
20240427152123
20240612123726
20240729123726
20240802193726
20240806073726
20241009103726
20250717082212
20250731150234
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.sessions (id, user_id, created_at, updated_at, factor_id, aal, not_after, refreshed_at, user_agent, ip, tag) FROM stdin;
0adbcf32-d711-4a22-9274-d4bb5c54c707	0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf	2025-09-11 08:25:43.738748+00	2025-09-11 09:24:08.699834+00	\N	aal1	\N	2025-09-11 09:24:08.699753	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36	42.107.225.23	\N
06bd1c1e-f5b3-4a13-b37e-1436c665f59d	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-09-11 15:40:13.213612+00	2025-09-11 17:23:15.292137+00	\N	aal1	\N	2025-09-11 17:23:15.29204	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	42.107.225.23	\N
5ce64711-3bb1-4a4a-9f83-f3b34da964d4	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-09-12 01:22:33.895218+00	2025-09-12 01:22:33.895218+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	42.105.48.88	\N
2370cc16-6ee1-4c32-b3f3-b83659b18cbc	2ff275bd-7b73-4ff7-8a3d-d6a49b57259e	2025-09-05 12:16:23.313692+00	2025-09-05 12:16:23.313692+00	\N	aal1	\N	\N	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36	106.207.185.172	\N
1bd299a0-a1a8-44ea-b971-91d4572c9252	c9bac630-48da-42ef-b8ca-68797ed6d652	2025-09-05 00:46:00.001063+00	2025-09-05 15:26:43.621891+00	\N	aal1	\N	2025-09-05 15:26:43.618653	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	42.105.56.0	\N
799cea78-dde3-4786-b0e6-30c31754917d	0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf	2025-09-08 19:02:48.122416+00	2025-09-08 19:02:48.122416+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	42.107.224.6	\N
\.


--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.sso_domains (id, sso_provider_id, domain, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.sso_providers (id, resource_id, created_at, updated_at, disabled) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) FROM stdin;
00000000-0000-0000-0000-000000000000	2ff275bd-7b73-4ff7-8a3d-d6a49b57259e	authenticated	authenticated	kartiksuthar295@gmail.com	\N	2025-09-05 12:16:23.293624+00	\N		\N		\N			\N	2025-09-05 12:16:23.313601+00	{"provider": "google", "providers": ["google"]}	{"iss": "https://accounts.google.com", "sub": "100088628231141428287", "name": "Kartik Suthar", "email": "kartiksuthar295@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIjO1CXFc57Ud73jnAQkwKluXSE1NMGronNr-8iAABL-LXqUA=s96-c", "full_name": "Kartik Suthar", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIjO1CXFc57Ud73jnAQkwKluXSE1NMGronNr-8iAABL-LXqUA=s96-c", "provider_id": "100088628231141428287", "email_verified": true, "phone_verified": false}	\N	2025-09-05 12:16:23.178569+00	2025-09-05 12:16:23.375568+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf	authenticated	authenticated	finprimebusiness@gmail.com	$2a$10$Fk7KsvaVI79s4fe5YFdfAeIk1V3QTsrFgbJT5nNW8URoMK7ryKo12	2025-08-29 04:46:33.028416+00	\N		\N		\N			\N	2025-09-11 08:25:43.737108+00	{"provider": "email", "providers": ["email"]}	{"sub": "0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf", "email": "finprimebusiness@gmail.com", "email_verified": true, "phone_verified": false}	\N	2025-08-29 04:46:33.005581+00	2025-09-11 09:24:08.69645+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	c9bac630-48da-42ef-b8ca-68797ed6d652	authenticated	authenticated	quizdangalofficial@gmail.com	\N	2025-08-16 14:53:28.494136+00	\N		\N		\N			\N	2025-09-05 00:46:00.000993+00	{"is_admin": true, "provider": "google", "providers": ["google"]}	{"iss": "https://accounts.google.com", "sub": "106847980397139222112", "name": "Govind", "email": "quizdangalofficial@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocKq00BwNSRBkOGLU04snbVIgYuuXZ_9GF1efcMkou8bac9y3xM=s96-c", "full_name": "Govind", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocKq00BwNSRBkOGLU04snbVIgYuuXZ_9GF1efcMkou8bac9y3xM=s96-c", "provider_id": "106847980397139222112", "email_verified": true, "phone_verified": false}	\N	2025-08-16 14:53:28.402422+00	2025-09-05 15:26:43.609558+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	d54f5f83-aa63-4630-b9be-dbdca91b9315	authenticated	authenticated	sutharji1122@gmail.com	$2a$10$2FLTxBVrZh3j6vtwBT8H7ORjUx6mw5KG4vgojUfZnTsTX/IM05JV6	2025-08-23 14:49:34.875525+00	\N		\N		2025-08-29 12:48:59.473073+00			\N	2025-09-12 01:22:33.894487+00	{"provider": "email", "providers": ["email", "google"]}	{"iss": "https://accounts.google.com", "sub": "118002990807929691971", "name": "Govind", "email": "sutharji1122@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIQKyDRHmvc2KvzlvpD3URLqVHjjxPTsl1pkuGfpieEsXdzejo=s96-c", "full_name": "Govind", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIQKyDRHmvc2KvzlvpD3URLqVHjjxPTsl1pkuGfpieEsXdzejo=s96-c", "provider_id": "118002990807929691971", "email_verified": true, "phone_verified": false}	\N	2025-08-23 14:49:34.758992+00	2025-09-12 01:22:33.936617+00	\N	\N			\N		0	\N		\N	f	\N	f
\.


--
-- Data for Name: job; Type: TABLE DATA; Schema: cron; Owner: -
--

COPY cron.job (jobid, schedule, command, nodename, nodeport, database, username, active, jobname) FROM stdin;
\.


--
-- Data for Name: job_run_details; Type: TABLE DATA; Schema: cron; Owner: -
--

COPY cron.job_run_details (jobid, runid, job_pid, database, username, command, status, return_message, start_time, end_time) FROM stdin;
1	10	1145344	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:26:00.014973+00	2025-08-25 03:26:00.016351+00
1	1	1144915	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:17:00.105271+00	2025-08-25 03:17:00.108523+00
1	7	1145071	postgres	postgres	select process_pending_quizzes();	failed	ERROR:  new row for relation "transactions" violates check constraint "chk_transactions_type"\nDETAIL:  Failing row contains (bac1275f-8e2b-4671-8a85-6a5a0abd5863, 8a8d92e1-fa8d-4d8f-92c1-c50531b4f96f, credit, 100, success, 2025-08-25 03:23:00.017567+00, 2025-08-25 03:23:00.017567+00).\nCONTEXT:  SQL statement "insert into public.transactions (id, user_id, type, amount, status, created_at)\r\n            values (gen_random_uuid(), r.user_id, 'credit', prize.prize_coins, 'success', now())"\nPL/pgSQL function finalize_quiz_results(uuid) line 41 at SQL statement\nSQL statement "SELECT finalize_quiz_results(q.id)"\nPL/pgSQL function process_pending_quizzes() line 10 at PERFORM\n	2025-08-25 03:23:00.017543+00	2025-08-25 03:23:00.021595+00
1	9	1145312	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:25:00.026206+00	2025-08-25 03:25:00.046693+00
1	2	1144949	postgres	postgres	select process_pending_quizzes();	failed	ERROR:  column q.correct_option_id does not exist\nLINE 5: ...blic.options o on o.question_id = q.id and o.id = q.correct_...\n                                                             ^\nQUERY:  select ua.user_id,\r\n               sum(case when o.id = ua.selected_option_id then 1 else 0 end) as score\r\n        from public.user_answers ua\r\n        join public.questions q on q.id = ua.question_id\r\n        join public.options o on o.question_id = q.id and o.id = q.correct_option_id\r\n        where q.quiz_id = p_quiz_id\r\n        group by ua.user_id\r\n        order by score desc\nCONTEXT:  PL/pgSQL function finalize_quiz_results(uuid) line 11 at FOR over SELECT rows\nSQL statement "SELECT finalize_quiz_results(q.id)"\nPL/pgSQL function process_pending_quizzes() line 10 at PERFORM\n	2025-08-25 03:18:00.015781+00	2025-08-25 03:18:00.020472+00
1	15	1145510	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:31:00.017762+00	2025-08-25 03:31:00.01911+00
1	8	1145192	postgres	postgres	select process_pending_quizzes();	failed	ERROR:  new row for relation "transactions" violates check constraint "chk_transactions_type"\nDETAIL:  Failing row contains (6353e3f0-32d6-4741-bbee-f2475742e7c1, 8a8d92e1-fa8d-4d8f-92c1-c50531b4f96f, credit, 100, success, 2025-08-25 03:24:00.019304+00, 2025-08-25 03:24:00.019304+00).\nCONTEXT:  SQL statement "insert into public.transactions (id, user_id, type, amount, status, created_at)\r\n            values (gen_random_uuid(), r.user_id, 'credit', prize.prize_coins, 'success', now())"\nPL/pgSQL function finalize_quiz_results(uuid) line 41 at SQL statement\nSQL statement "SELECT finalize_quiz_results(q.id)"\nPL/pgSQL function process_pending_quizzes() line 10 at PERFORM\n	2025-08-25 03:24:00.0191+00	2025-08-25 03:24:00.030006+00
1	3	1144961	postgres	postgres	select process_pending_quizzes();	failed	ERROR:  column q.correct_option_id does not exist\nLINE 5: ...blic.options o on o.question_id = q.id and o.id = q.correct_...\n                                                             ^\nQUERY:  select ua.user_id,\r\n               sum(case when o.id = ua.selected_option_id then 1 else 0 end) as score\r\n        from public.user_answers ua\r\n        join public.questions q on q.id = ua.question_id\r\n        join public.options o on o.question_id = q.id and o.id = q.correct_option_id\r\n        where q.quiz_id = p_quiz_id\r\n        group by ua.user_id\r\n        order by score desc\nCONTEXT:  PL/pgSQL function finalize_quiz_results(uuid) line 11 at FOR over SELECT rows\nSQL statement "SELECT finalize_quiz_results(q.id)"\nPL/pgSQL function process_pending_quizzes() line 10 at PERFORM\n	2025-08-25 03:19:00.014747+00	2025-08-25 03:19:00.016864+00
1	14	1145455	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:30:00.014775+00	2025-08-25 03:30:00.016196+00
1	12	1145392	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:28:00.016109+00	2025-08-25 03:28:00.017471+00
1	4	1144977	postgres	postgres	select process_pending_quizzes();	failed	ERROR:  column q.correct_option_id does not exist\nLINE 5: ...blic.options o on o.question_id = q.id and o.id = q.correct_...\n                                                             ^\nQUERY:  select ua.user_id,\r\n               sum(case when o.id = ua.selected_option_id then 1 else 0 end) as score\r\n        from public.user_answers ua\r\n        join public.questions q on q.id = ua.question_id\r\n        join public.options o on o.question_id = q.id and o.id = q.correct_option_id\r\n        where q.quiz_id = p_quiz_id\r\n        group by ua.user_id\r\n        order by score desc\nCONTEXT:  PL/pgSQL function finalize_quiz_results(uuid) line 11 at FOR over SELECT rows\nSQL statement "SELECT finalize_quiz_results(q.id)"\nPL/pgSQL function process_pending_quizzes() line 10 at PERFORM\n	2025-08-25 03:20:00.014905+00	2025-08-25 03:20:00.017483+00
1	11	1145356	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:27:00.020266+00	2025-08-25 03:27:00.021658+00
1	5	1145003	postgres	postgres	select process_pending_quizzes();	failed	ERROR:  column q.correct_option_id does not exist\nLINE 5: ...blic.options o on o.question_id = q.id and o.id = q.correct_...\n                                                             ^\nQUERY:  select ua.user_id,\r\n               sum(case when o.id = ua.selected_option_id then 1 else 0 end) as score\r\n        from public.user_answers ua\r\n        join public.questions q on q.id = ua.question_id\r\n        join public.options o on o.question_id = q.id and o.id = q.correct_option_id\r\n        where q.quiz_id = p_quiz_id\r\n        group by ua.user_id\r\n        order by score desc\nCONTEXT:  PL/pgSQL function finalize_quiz_results(uuid) line 11 at FOR over SELECT rows\nSQL statement "SELECT finalize_quiz_results(q.id)"\nPL/pgSQL function process_pending_quizzes() line 10 at PERFORM\n	2025-08-25 03:21:00.017316+00	2025-08-25 03:21:00.019572+00
1	13	1145417	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:29:00.0147+00	2025-08-25 03:29:00.016101+00
1	6	1145020	postgres	postgres	select process_pending_quizzes();	failed	ERROR:  column q.correct_option_id does not exist\nLINE 5: ...blic.options o on o.question_id = q.id and o.id = q.correct_...\n                                                             ^\nQUERY:  select ua.user_id,\r\n               sum(case when o.id = ua.selected_option_id then 1 else 0 end) as score\r\n        from public.user_answers ua\r\n        join public.questions q on q.id = ua.question_id\r\n        join public.options o on o.question_id = q.id and o.id = q.correct_option_id\r\n        where q.quiz_id = p_quiz_id\r\n        group by ua.user_id\r\n        order by score desc\nCONTEXT:  PL/pgSQL function finalize_quiz_results(uuid) line 11 at FOR over SELECT rows\nSQL statement "SELECT finalize_quiz_results(q.id)"\nPL/pgSQL function process_pending_quizzes() line 10 at PERFORM\n	2025-08-25 03:22:00.018173+00	2025-08-25 03:22:00.020425+00
1	16	1145549	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:32:00.015204+00	2025-08-25 03:32:00.016663+00
1	17	1145577	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:33:00.019347+00	2025-08-25 03:33:00.020643+00
1	18	1145791	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:34:00.1079+00	2025-08-25 03:34:00.10938+00
1	53	1147642	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:09:00.014509+00	2025-08-25 04:09:00.015903+00
1	40	1146961	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:56:00.014899+00	2025-08-25 03:56:00.016291+00
1	19	1145826	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:35:00.020565+00	2025-08-25 03:35:00.022281+00
1	31	1146413	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:47:00.014229+00	2025-08-25 03:47:00.015669+00
1	20	1145858	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:36:00.018009+00	2025-08-25 03:36:00.019373+00
1	67	1148172	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:23:00.015977+00	2025-08-25 04:23:00.017406+00
1	48	1147237	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:04:00.018616+00	2025-08-25 04:04:00.020683+00
1	32	1146440	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:48:00.017741+00	2025-08-25 03:48:00.019272+00
1	21	1145897	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:37:00.014852+00	2025-08-25 03:37:00.016227+00
1	41	1146992	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:57:00.018774+00	2025-08-25 03:57:00.020152+00
1	22	1145923	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:38:00.015746+00	2025-08-25 03:38:00.018564+00
1	33	1146467	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:49:00.017111+00	2025-08-25 03:49:00.018464+00
1	23	1145983	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:39:00.014508+00	2025-08-25 03:39:00.015885+00
1	61	1147987	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:17:00.014505+00	2025-08-25 04:17:00.015878+00
1	42	1147040	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:58:00.016713+00	2025-08-25 03:58:00.018076+00
1	24	1146005	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:40:00.015571+00	2025-08-25 03:40:00.016982+00
1	34	1146498	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:50:00.017741+00	2025-08-25 03:50:00.019128+00
1	25	1146037	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:41:00.015018+00	2025-08-25 03:41:00.01645+00
1	54	1147685	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:10:00.018273+00	2025-08-25 04:10:00.019873+00
1	49	1147457	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:05:00.098187+00	2025-08-25 04:05:00.09969+00
1	35	1146547	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:51:00.014549+00	2025-08-25 03:51:00.016107+00
1	26	1146066	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:42:00.014699+00	2025-08-25 03:42:00.01618+00
1	43	1147088	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:59:00.020012+00	2025-08-25 03:59:00.021369+00
1	27	1146095	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:43:00.020133+00	2025-08-25 03:43:00.021502+00
1	36	1146575	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:52:00.014557+00	2025-08-25 03:52:00.016013+00
1	28	1146141	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:44:00.014878+00	2025-08-25 03:44:00.016254+00
1	58	1147939	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:14:00.017627+00	2025-08-25 04:14:00.019172+00
1	29	1146364	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:45:00.03804+00	2025-08-25 03:45:00.04611+00
1	37	1146794	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:53:00.062037+00	2025-08-25 03:53:00.063491+00
1	44	1147115	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:00:00.016598+00	2025-08-25 04:00:00.018047+00
1	30	1146387	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:46:00.01418+00	2025-08-25 03:46:00.015593+00
1	50	1147531	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:06:00.01575+00	2025-08-25 04:06:00.017116+00
1	38	1146857	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:54:00.017727+00	2025-08-25 03:54:00.020174+00
1	45	1147143	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:01:00.017448+00	2025-08-25 04:01:00.018853+00
1	39	1146908	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 03:55:00.014732+00	2025-08-25 03:55:00.016132+00
1	55	1147714	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:11:00.014491+00	2025-08-25 04:11:00.015861+00
1	51	1147559	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:07:00.015168+00	2025-08-25 04:07:00.016528+00
1	46	1147177	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:02:00.021115+00	2025-08-25 04:02:00.022632+00
1	70	1148473	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:26:00.01727+00	2025-08-25 04:26:00.018746+00
1	64	1148046	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:20:00.015109+00	2025-08-25 04:20:00.016626+00
1	59	1147951	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:15:00.014626+00	2025-08-25 04:15:00.016065+00
1	47	1147201	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:03:00.01897+00	2025-08-25 04:03:00.020369+00
1	52	1147614	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:08:00.019622+00	2025-08-25 04:08:00.020948+00
1	56	1147915	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:12:00.066457+00	2025-08-25 04:12:00.084945+00
1	62	1148003	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:18:00.016188+00	2025-08-25 04:18:00.017633+00
1	57	1147927	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:13:00.017282+00	2025-08-25 04:13:00.018791+00
1	60	1147970	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:16:00.014809+00	2025-08-25 04:16:00.016164+00
1	66	1148109	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:22:00.015413+00	2025-08-25 04:22:00.017059+00
1	65	1148073	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:21:00.018188+00	2025-08-25 04:21:00.019707+00
1	63	1148028	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:19:00.015342+00	2025-08-25 04:19:00.016745+00
1	71	1148497	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:27:00.018628+00	2025-08-25 04:27:00.02126+00
1	69	1148431	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:25:00.040614+00	2025-08-25 04:25:00.045719+00
1	68	1148214	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:24:00.014873+00	2025-08-25 04:24:00.016302+00
1	72	1148530	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:28:00.016817+00	2025-08-25 04:28:00.018234+00
1	73	1148566	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:29:00.01726+00	2025-08-25 04:29:00.018718+00
1	74	1148595	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:30:00.01738+00	2025-08-25 04:30:00.018814+00
1	75	1148629	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:31:00.018476+00	2025-08-25 04:31:00.019862+00
1	76	1148669	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:32:00.01811+00	2025-08-25 04:32:00.019632+00
1	77	1148886	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:33:00.04646+00	2025-08-25 04:33:00.049369+00
1	112	1150308	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:08:00.01539+00	2025-08-25 05:08:00.016773+00
1	99	1149935	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:55:00.015055+00	2025-08-25 04:55:00.016544+00
1	78	1148914	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:34:00.018237+00	2025-08-25 04:34:00.019667+00
1	90	1149516	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:46:00.014991+00	2025-08-25 04:46:00.016481+00
1	79	1148948	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:35:00.0156+00	2025-08-25 04:35:00.017018+00
1	126	1150946	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:22:00.056228+00	2025-08-25 05:22:00.061418+00
1	107	1150238	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:03:00.017251+00	2025-08-25 05:03:00.020054+00
1	91	1149546	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:47:00.014766+00	2025-08-25 04:47:00.016126+00
1	80	1148981	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:36:00.019536+00	2025-08-25 04:36:00.020981+00
1	100	1149954	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:56:00.015805+00	2025-08-25 04:56:00.017362+00
1	81	1149018	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:37:00.020088+00	2025-08-25 04:37:00.021775+00
1	92	1149600	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:48:00.018453+00	2025-08-25 04:48:00.019781+00
1	82	1149055	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:38:00.016846+00	2025-08-25 04:38:00.018303+00
1	120	1150674	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:16:00.014691+00	2025-08-25 05:16:00.016153+00
1	101	1149971	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:57:00.015256+00	2025-08-25 04:57:00.016607+00
1	83	1149085	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:39:00.017252+00	2025-08-25 04:39:00.018652+00
1	93	1149628	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:49:00.014099+00	2025-08-25 04:49:00.015479+00
1	84	1149132	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:40:00.015319+00	2025-08-25 04:40:00.016707+00
1	113	1150328	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:09:00.015016+00	2025-08-25 05:09:00.016441+00
1	108	1150250	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:04:00.014895+00	2025-08-25 05:04:00.016259+00
1	94	1149646	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:50:00.014527+00	2025-08-25 04:50:00.016658+00
1	85	1149158	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:41:00.016604+00	2025-08-25 04:41:00.017995+00
1	102	1149983	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:58:00.015378+00	2025-08-25 04:58:00.017118+00
1	86	1149192	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:42:00.019523+00	2025-08-25 04:42:00.020892+00
1	95	1149704	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:51:00.021693+00	2025-08-25 04:51:00.023306+00
1	87	1149394	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:43:00.102285+00	2025-08-25 04:43:00.11014+00
1	117	1150442	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:13:00.019655+00	2025-08-25 05:13:00.021+00
1	88	1149432	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:44:00.01472+00	2025-08-25 04:44:00.016182+00
1	96	1149865	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:52:00.014839+00	2025-08-25 04:52:00.019926+00
1	103	1149996	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:59:00.01533+00	2025-08-25 04:59:00.016675+00
1	89	1149471	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:45:00.01792+00	2025-08-25 04:45:00.019342+00
1	109	1150262	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:05:00.014602+00	2025-08-25 05:05:00.015982+00
1	97	1149909	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:53:00.020597+00	2025-08-25 04:53:00.02197+00
1	104	1150008	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:00:00.015108+00	2025-08-25 05:00:00.016511+00
1	98	1149923	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 04:54:00.015277+00	2025-08-25 04:54:00.016737+00
1	114	1150364	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:10:00.017391+00	2025-08-25 05:10:00.01877+00
1	110	1150281	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:06:00.014655+00	2025-08-25 05:06:00.016007+00
1	105	1150023	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:01:00.015513+00	2025-08-25 05:01:00.017014+00
1	129	1151004	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:25:00.015086+00	2025-08-25 05:25:00.016499+00
1	123	1150721	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:19:00.014901+00	2025-08-25 05:19:00.016313+00
1	118	1150455	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:14:00.015579+00	2025-08-25 05:14:00.01703+00
1	106	1150050	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:02:00.018754+00	2025-08-25 05:02:00.020928+00
1	111	1150293	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:07:00.014653+00	2025-08-25 05:07:00.015997+00
1	115	1150390	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:11:00.015481+00	2025-08-25 05:11:00.016978+00
1	121	1150687	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:17:00.015269+00	2025-08-25 05:17:00.016745+00
1	116	1150402	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:12:00.014496+00	2025-08-25 05:12:00.015877+00
1	119	1150656	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:15:00.065817+00	2025-08-25 05:15:00.075639+00
1	125	1150748	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:21:00.014979+00	2025-08-25 05:21:00.016437+00
1	124	1150733	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:20:00.014525+00	2025-08-25 05:20:00.015897+00
1	122	1150707	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:18:00.016689+00	2025-08-25 05:18:00.018124+00
1	130	1151024	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:26:00.015076+00	2025-08-25 05:26:00.016516+00
1	128	1150987	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:24:00.020198+00	2025-08-25 05:24:00.021553+00
1	127	1150961	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:23:00.016866+00	2025-08-25 05:23:00.018324+00
1	131	1151036	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:27:00.014445+00	2025-08-25 05:27:00.015864+00
1	132	1151062	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:28:00.019682+00	2025-08-25 05:28:00.020993+00
1	133	1151074	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:29:00.014967+00	2025-08-25 05:29:00.016345+00
1	134	1151098	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:30:00.017288+00	2025-08-25 05:30:00.018654+00
1	135	1151114	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:31:00.01467+00	2025-08-25 05:31:00.016146+00
1	136	1151127	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:32:00.014706+00	2025-08-25 05:32:00.016086+00
1	171	1152759	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:07:00.01453+00	2025-08-25 06:07:00.015926+00
1	158	1152359	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:54:00.018429+00	2025-08-25 05:54:00.01977+00
1	137	1151150	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:33:00.018835+00	2025-08-25 05:33:00.020317+00
1	149	1151858	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:45:00.03025+00	2025-08-25 05:45:00.032473+00
1	138	1151172	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:34:00.014998+00	2025-08-25 05:34:00.016451+00
1	185	1153218	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:21:00.014995+00	2025-08-25 06:21:00.016519+00
1	166	1152503	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:02:00.014627+00	2025-08-25 06:02:00.015993+00
1	150	1151904	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:46:00.014888+00	2025-08-25 05:46:00.016247+00
1	139	1151376	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:35:00.126928+00	2025-08-25 05:35:00.133048+00
1	159	1152373	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:55:00.018361+00	2025-08-25 05:55:00.019721+00
1	140	1151394	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:36:00.014364+00	2025-08-25 05:36:00.015754+00
1	151	1151946	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:47:00.015712+00	2025-08-25 05:47:00.017278+00
1	141	1151410	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:37:00.014592+00	2025-08-25 05:37:00.016027+00
1	179	1153057	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:15:00.032888+00	2025-08-25 06:15:00.035577+00
1	160	1152422	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:56:00.017609+00	2025-08-25 05:56:00.018947+00
1	142	1151449	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:38:00.01703+00	2025-08-25 05:38:00.018481+00
1	152	1151986	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:48:00.019989+00	2025-08-25 05:48:00.021399+00
1	143	1151474	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:39:00.015147+00	2025-08-25 05:39:00.0166+00
1	172	1152772	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:08:00.015738+00	2025-08-25 06:08:00.017198+00
1	167	1152515	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:03:00.015553+00	2025-08-25 06:03:00.016974+00
1	153	1152007	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:49:00.014663+00	2025-08-25 05:49:00.016028+00
1	144	1151492	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:40:00.015311+00	2025-08-25 05:40:00.016768+00
1	161	1152434	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:57:00.015008+00	2025-08-25 05:57:00.016416+00
1	145	1151511	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:41:00.014869+00	2025-08-25 05:41:00.016264+00
1	154	1152046	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:50:00.017255+00	2025-08-25 05:50:00.018649+00
1	146	1151543	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:42:00.014714+00	2025-08-25 05:42:00.016662+00
1	176	1152828	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:12:00.014931+00	2025-08-25 06:12:00.016338+00
1	147	1151588	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:43:00.019008+00	2025-08-25 05:43:00.020412+00
1	155	1152072	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:51:00.013701+00	2025-08-25 05:51:00.015227+00
1	162	1152449	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:58:00.0158+00	2025-08-25 05:58:00.017203+00
1	148	1151622	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:44:00.014382+00	2025-08-25 05:44:00.015828+00
1	168	1152716	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:04:00.053309+00	2025-08-25 06:04:00.060076+00
1	156	1152309	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:52:00.081937+00	2025-08-25 05:52:00.083347+00
1	163	1152461	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:59:00.014314+00	2025-08-25 05:59:00.015797+00
1	157	1152331	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 05:53:00.01637+00	2025-08-25 05:53:00.017763+00
1	173	1152787	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:09:00.015404+00	2025-08-25 06:09:00.016955+00
1	169	1152728	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:05:00.016226+00	2025-08-25 06:05:00.017863+00
1	164	1152473	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:00:00.014527+00	2025-08-25 06:00:00.015922+00
1	188	1153446	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:24:00.05596+00	2025-08-25 06:24:00.066109+00
1	182	1153104	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:18:00.01664+00	2025-08-25 06:18:00.01808+00
1	177	1152840	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:13:00.016404+00	2025-08-25 06:13:00.017842+00
1	165	1152490	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:01:00.015123+00	2025-08-25 06:01:00.017191+00
1	170	1152747	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:06:00.014959+00	2025-08-25 06:06:00.01636+00
1	174	1152800	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:10:00.014515+00	2025-08-25 06:10:00.015865+00
1	180	1153075	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:16:00.014187+00	2025-08-25 06:16:00.015659+00
1	175	1152815	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:11:00.014687+00	2025-08-25 06:11:00.016198+00
1	178	1152856	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:14:00.015292+00	2025-08-25 06:14:00.016694+00
1	184	1153203	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:20:00.015287+00	2025-08-25 06:20:00.016707+00
1	183	1153191	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:19:00.014705+00	2025-08-25 06:19:00.016058+00
1	181	1153087	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:17:00.014638+00	2025-08-25 06:17:00.015969+00
1	189	1153459	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:25:00.015698+00	2025-08-25 06:25:00.01709+00
1	187	1153243	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:23:00.016934+00	2025-08-25 06:23:00.018337+00
1	186	1153230	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:22:00.015343+00	2025-08-25 06:22:00.016694+00
1	190	1153550	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:26:00.01576+00	2025-08-25 06:26:00.017181+00
1	191	1153562	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:27:00.016335+00	2025-08-25 06:27:00.01771+00
1	192	1153574	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:28:00.017453+00	2025-08-25 06:28:00.018904+00
1	193	1153589	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:29:00.014209+00	2025-08-25 06:29:00.015631+00
1	194	1153601	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:30:00.015935+00	2025-08-25 06:30:00.017384+00
1	195	1153616	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:31:00.014352+00	2025-08-25 06:31:00.015732+00
1	230	1154857	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:06:00.015236+00	2025-08-25 07:06:00.016656+00
1	217	1154298	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:53:00.01743+00	2025-08-25 06:53:00.01991+00
1	196	1153629	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:32:00.017433+00	2025-08-25 06:32:00.018942+00
1	208	1153980	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:44:00.015449+00	2025-08-25 06:44:00.016841+00
1	197	1153641	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:33:00.016053+00	2025-08-25 06:33:00.017476+00
1	244	1155241	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:20:00.014811+00	2025-08-25 07:20:00.016135+00
1	225	1154600	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:01:00.015237+00	2025-08-25 07:01:00.016657+00
1	209	1154185	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:45:00.048151+00	2025-08-25 06:45:00.063442+00
1	198	1153842	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:34:00.032592+00	2025-08-25 06:34:00.041411+00
1	218	1154310	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:54:00.015189+00	2025-08-25 06:54:00.016612+00
1	199	1153857	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:35:00.014761+00	2025-08-25 06:35:00.016158+00
1	210	1154204	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:46:00.015188+00	2025-08-25 06:46:00.016698+00
1	200	1153875	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:36:00.014923+00	2025-08-25 06:36:00.016262+00
1	238	1155151	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:14:00.015375+00	2025-08-25 07:14:00.016702+00
1	219	1154513	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:55:00.020546+00	2025-08-25 06:55:00.0266+00
1	201	1153888	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:37:00.015074+00	2025-08-25 06:37:00.016434+00
1	211	1154216	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:47:00.015706+00	2025-08-25 06:47:00.01704+00
1	202	1153900	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:38:00.017031+00	2025-08-25 06:38:00.018431+00
1	231	1154870	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:07:00.016401+00	2025-08-25 07:07:00.017747+00
1	226	1154612	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:02:00.015215+00	2025-08-25 07:02:00.016594+00
1	212	1154229	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:48:00.016672+00	2025-08-25 06:48:00.018071+00
1	203	1153913	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:39:00.01491+00	2025-08-25 06:39:00.017318+00
1	220	1154531	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:56:00.01481+00	2025-08-25 06:56:00.016133+00
1	204	1153928	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:40:00.015879+00	2025-08-25 06:40:00.017247+00
1	213	1154242	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:49:00.016228+00	2025-08-25 06:49:00.017591+00
1	205	1153943	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:41:00.014879+00	2025-08-25 06:41:00.016264+00
1	235	1154926	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:11:00.015566+00	2025-08-25 07:11:00.016946+00
1	206	1153956	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:42:00.01572+00	2025-08-25 06:42:00.017403+00
1	214	1154257	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:50:00.016156+00	2025-08-25 06:50:00.017552+00
1	221	1154544	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:57:00.015605+00	2025-08-25 06:57:00.016993+00
1	207	1153968	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:43:00.016627+00	2025-08-25 06:43:00.018013+00
1	227	1154625	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:03:00.018749+00	2025-08-25 07:03:00.020087+00
1	215	1154272	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:51:00.014518+00	2025-08-25 06:51:00.015867+00
1	222	1154556	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:58:00.018289+00	2025-08-25 06:58:00.019658+00
1	216	1154285	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:52:00.014581+00	2025-08-25 06:52:00.015905+00
1	232	1154884	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:08:00.018624+00	2025-08-25 07:08:00.020015+00
1	228	1154824	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:04:00.02459+00	2025-08-25 07:04:00.031053+00
1	223	1154569	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 06:59:00.014258+00	2025-08-25 06:59:00.015611+00
1	247	1155469	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:23:00.059385+00	2025-08-25 07:23:00.100074+00
1	241	1155197	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:17:00.015203+00	2025-08-25 07:17:00.016544+00
1	236	1155125	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:12:00.016209+00	2025-08-25 07:12:00.026578+00
1	224	1154584	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:00:00.014677+00	2025-08-25 07:00:00.015973+00
1	229	1154839	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:05:00.014533+00	2025-08-25 07:05:00.015902+00
1	233	1154896	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:09:00.014529+00	2025-08-25 07:09:00.015847+00
1	239	1155166	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:15:00.014924+00	2025-08-25 07:15:00.016336+00
1	234	1154911	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:10:00.014636+00	2025-08-25 07:10:00.01599+00
1	237	1155138	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:13:00.017919+00	2025-08-25 07:13:00.019277+00
1	243	1155225	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:19:00.014851+00	2025-08-25 07:19:00.016143+00
1	242	1155213	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:18:00.018292+00	2025-08-25 07:18:00.019747+00
1	240	1155184	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:16:00.016725+00	2025-08-25 07:16:00.018111+00
1	248	1155482	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:24:00.014375+00	2025-08-25 07:24:00.016658+00
1	246	1155268	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:22:00.016438+00	2025-08-25 07:22:00.017929+00
1	245	1155256	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:21:00.014463+00	2025-08-25 07:21:00.015758+00
1	249	1155497	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:25:00.015381+00	2025-08-25 07:25:00.016731+00
1	250	1155515	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:26:00.015617+00	2025-08-25 07:26:00.017383+00
1	251	1155528	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:27:00.01478+00	2025-08-25 07:27:00.016102+00
1	252	1155541	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:28:00.018704+00	2025-08-25 07:28:00.020038+00
1	253	1155553	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:29:00.014567+00	2025-08-25 07:29:00.015938+00
1	254	1155568	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:30:00.015007+00	2025-08-25 07:30:00.016365+00
1	289	1156810	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:05:00.014895+00	2025-08-25 08:05:00.016317+00
1	276	1156253	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:52:00.015193+00	2025-08-25 07:52:00.016629+00
1	255	1155584	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:31:00.01736+00	2025-08-25 07:31:00.018732+00
1	267	1156123	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:43:00.02036+00	2025-08-25 07:43:00.021696+00
1	256	1155597	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:32:00.014718+00	2025-08-25 07:32:00.016116+00
1	303	1157203	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:19:00.014363+00	2025-08-25 08:19:00.015703+00
1	284	1156552	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:00:00.014172+00	2025-08-25 08:00:00.015515+00
1	268	1156136	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:44:00.017134+00	2025-08-25 07:44:00.018586+00
1	257	1155610	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:33:00.015851+00	2025-08-25 07:33:00.017182+00
1	277	1156457	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:53:00.022134+00	2025-08-25 07:53:00.028102+00
1	258	1155810	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:34:00.022723+00	2025-08-25 07:34:00.02743+00
1	269	1156149	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:45:00.018061+00	2025-08-25 07:45:00.019554+00
1	259	1155825	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:35:00.014899+00	2025-08-25 07:35:00.01628+00
1	297	1157116	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:13:00.035696+00	2025-08-25 08:13:00.037879+00
1	278	1156469	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:54:00.015666+00	2025-08-25 07:54:00.017052+00
1	260	1155843	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:36:00.015098+00	2025-08-25 07:36:00.016407+00
1	270	1156171	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:46:00.016037+00	2025-08-25 07:46:00.01738+00
1	261	1155856	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:37:00.015043+00	2025-08-25 07:37:00.016382+00
1	290	1156828	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:06:00.01705+00	2025-08-25 08:06:00.018549+00
1	285	1156570	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:01:00.014422+00	2025-08-25 08:01:00.015774+00
1	271	1156183	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:47:00.014868+00	2025-08-25 07:47:00.016214+00
1	262	1155868	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:38:00.016769+00	2025-08-25 07:38:00.018102+00
1	279	1156481	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:55:00.014877+00	2025-08-25 07:55:00.01636+00
1	263	1155881	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:39:00.016073+00	2025-08-25 07:39:00.017449+00
1	272	1156196	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:48:00.017728+00	2025-08-25 07:48:00.019123+00
1	264	1155894	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:40:00.014912+00	2025-08-25 07:40:00.016275+00
1	294	1156882	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:10:00.014228+00	2025-08-25 08:10:00.015595+00
1	265	1155912	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:41:00.01497+00	2025-08-25 07:41:00.016332+00
1	273	1156209	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:49:00.014827+00	2025-08-25 07:49:00.016169+00
1	280	1156502	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:56:00.014823+00	2025-08-25 07:56:00.016153+00
1	266	1156111	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:42:00.048434+00	2025-08-25 07:42:00.069879+00
1	286	1156582	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:02:00.015009+00	2025-08-25 08:02:00.017419+00
1	274	1156221	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:50:00.016911+00	2025-08-25 07:50:00.018222+00
1	281	1156515	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:57:00.01444+00	2025-08-25 07:57:00.015732+00
1	275	1156240	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:51:00.015201+00	2025-08-25 07:51:00.016554+00
1	291	1156844	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:07:00.014833+00	2025-08-25 08:07:00.016779+00
1	287	1156594	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:03:00.018038+00	2025-08-25 08:03:00.019657+00
1	282	1156527	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:58:00.019448+00	2025-08-25 07:58:00.020751+00
1	306	1157245	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:22:00.014759+00	2025-08-25 08:22:00.016098+00
1	300	1157158	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:16:00.014699+00	2025-08-25 08:16:00.016042+00
1	295	1156898	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:11:00.014355+00	2025-08-25 08:11:00.015715+00
1	283	1156540	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 07:59:00.014277+00	2025-08-25 07:59:00.015605+00
1	288	1156797	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:04:00.024159+00	2025-08-25 08:04:00.035622+00
1	292	1156856	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:08:00.017171+00	2025-08-25 08:08:00.018553+00
1	298	1157128	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:14:00.014862+00	2025-08-25 08:14:00.016316+00
1	293	1156870	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:09:00.016287+00	2025-08-25 08:09:00.017609+00
1	296	1156913	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:12:00.015577+00	2025-08-25 08:12:00.016945+00
1	302	1157190	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:18:00.018092+00	2025-08-25 08:18:00.019477+00
1	301	1157174	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:17:00.016538+00	2025-08-25 08:17:00.018208+00
1	299	1157140	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:15:00.015521+00	2025-08-25 08:15:00.016909+00
1	307	1157257	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:23:00.01664+00	2025-08-25 08:23:00.017986+00
1	305	1157230	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:21:00.015056+00	2025-08-25 08:21:00.016619+00
1	304	1157215	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:20:00.015651+00	2025-08-25 08:20:00.016978+00
1	308	1157461	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:24:00.101773+00	2025-08-25 08:24:00.117465+00
1	309	1157473	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:25:00.015048+00	2025-08-25 08:25:00.016399+00
1	310	1157493	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:26:00.014451+00	2025-08-25 08:26:00.015845+00
1	311	1157508	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:27:00.016264+00	2025-08-25 08:27:00.0186+00
1	312	1157520	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:28:00.017387+00	2025-08-25 08:28:00.018755+00
1	313	1157532	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:29:00.014952+00	2025-08-25 08:29:00.016279+00
1	348	1158584	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:04:00.01487+00	2025-08-25 09:04:00.016293+00
1	335	1158218	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:51:00.014354+00	2025-08-25 08:51:00.015685+00
1	314	1157544	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:30:00.018202+00	2025-08-25 08:30:00.019558+00
1	326	1157901	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:42:00.015257+00	2025-08-25 08:42:00.016601+00
1	315	1157749	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:31:00.181338+00	2025-08-25 08:31:00.193883+00
1	362	1159159	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:18:00.016055+00	2025-08-25 09:18:00.017376+00
1	343	1158517	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:59:00.015861+00	2025-08-25 08:59:00.0172+00
1	327	1157916	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:43:00.016985+00	2025-08-25 08:43:00.018468+00
1	316	1157765	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:32:00.014859+00	2025-08-25 08:32:00.016196+00
1	336	1158419	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:52:00.02323+00	2025-08-25 08:52:00.033966+00
1	317	1157777	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:33:00.017827+00	2025-08-25 08:33:00.01924+00
1	328	1158116	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:44:00.018993+00	2025-08-25 08:44:00.028058+00
1	318	1157790	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:34:00.016141+00	2025-08-25 08:34:00.017529+00
1	356	1159072	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:12:00.026426+00	2025-08-25 09:12:00.033672+00
1	337	1158435	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:53:00.017845+00	2025-08-25 08:53:00.019214+00
1	319	1157802	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:35:00.015557+00	2025-08-25 08:35:00.018081+00
1	329	1158129	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:45:00.01627+00	2025-08-25 08:45:00.017689+00
1	320	1157821	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:36:00.015041+00	2025-08-25 08:36:00.016398+00
1	349	1158786	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:05:00.019563+00	2025-08-25 09:05:00.070228+00
1	344	1158529	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:00:00.01452+00	2025-08-25 09:00:00.015863+00
1	330	1158148	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:46:00.014889+00	2025-08-25 08:46:00.016331+00
1	321	1157836	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:37:00.014967+00	2025-08-25 08:37:00.016259+00
1	338	1158447	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:54:00.015324+00	2025-08-25 08:54:00.016779+00
1	322	1157848	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:38:00.019577+00	2025-08-25 08:38:00.02095+00
1	331	1158160	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:47:00.015081+00	2025-08-25 08:47:00.016475+00
1	323	1157861	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:39:00.015605+00	2025-08-25 08:39:00.017006+00
1	353	1158843	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:09:00.015048+00	2025-08-25 09:09:00.016368+00
1	324	1157874	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:40:00.015302+00	2025-08-25 08:40:00.01669+00
1	332	1158176	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:48:00.016425+00	2025-08-25 08:48:00.017777+00
1	339	1158459	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:55:00.014651+00	2025-08-25 08:55:00.016029+00
1	325	1157889	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:41:00.014494+00	2025-08-25 08:41:00.015851+00
1	345	1158544	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:01:00.016053+00	2025-08-25 09:01:00.017511+00
1	333	1158189	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:49:00.016146+00	2025-08-25 08:49:00.017528+00
1	340	1158477	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:56:00.014723+00	2025-08-25 08:56:00.016045+00
1	334	1158201	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:50:00.015668+00	2025-08-25 08:50:00.016992+00
1	350	1158804	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:06:00.01596+00	2025-08-25 09:06:00.017293+00
1	346	1158556	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:02:00.014332+00	2025-08-25 09:02:00.015709+00
1	341	1158489	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:57:00.015036+00	2025-08-25 08:57:00.016389+00
1	365	1159202	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:21:00.014732+00	2025-08-25 09:21:00.016071+00
1	359	1159111	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:15:00.015209+00	2025-08-25 09:15:00.016715+00
1	354	1158855	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:10:00.014519+00	2025-08-25 09:10:00.015875+00
1	342	1158504	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 08:58:00.017768+00	2025-08-25 08:58:00.019143+00
1	347	1158572	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:03:00.017367+00	2025-08-25 09:03:00.018778+00
1	351	1158816	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:07:00.014831+00	2025-08-25 09:07:00.01613+00
1	357	1159084	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:13:00.017416+00	2025-08-25 09:13:00.018822+00
1	352	1158828	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:08:00.017579+00	2025-08-25 09:08:00.019109+00
1	355	1158871	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:11:00.015789+00	2025-08-25 09:11:00.017213+00
1	361	1159141	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:17:00.015517+00	2025-08-25 09:17:00.016848+00
1	360	1159129	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:16:00.015192+00	2025-08-25 09:16:00.016537+00
1	358	1159099	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:14:00.01633+00	2025-08-25 09:14:00.017788+00
1	366	1159214	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:22:00.014696+00	2025-08-25 09:22:00.016013+00
1	364	1159187	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:20:00.015655+00	2025-08-25 09:20:00.017038+00
1	363	1159175	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:19:00.014274+00	2025-08-25 09:19:00.015621+00
1	367	1159226	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:23:00.017532+00	2025-08-25 09:23:00.018851+00
1	368	1159242	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:24:00.014213+00	2025-08-25 09:24:00.015557+00
1	369	1159446	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:25:00.022683+00	2025-08-25 09:25:00.030162+00
1	370	1159464	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:26:00.015066+00	2025-08-25 09:26:00.016391+00
1	371	1159476	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:27:00.014769+00	2025-08-25 09:27:00.016091+00
1	372	1159488	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:28:00.02029+00	2025-08-25 09:28:00.021707+00
1	407	1160728	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:03:00.124333+00	2025-08-25 10:03:00.180324+00
1	394	1160175	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:50:00.015298+00	2025-08-25 09:50:00.016604+00
1	373	1159503	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:29:00.018945+00	2025-08-25 09:29:00.020303+00
1	385	1160048	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:41:00.085013+00	2025-08-25 09:41:00.097014+00
1	374	1159516	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:30:00.014482+00	2025-08-25 09:30:00.015823+00
1	421	1161112	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:17:00.015894+00	2025-08-25 10:17:00.017221+00
1	402	1160473	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:58:00.01977+00	2025-08-25 09:58:00.021099+00
1	386	1160060	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:42:00.016083+00	2025-08-25 09:42:00.017455+00
1	375	1159532	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:31:00.01488+00	2025-08-25 09:31:00.016178+00
1	395	1160190	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:51:00.014533+00	2025-08-25 09:51:00.015839+00
1	376	1159734	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:32:00.102037+00	2025-08-25 09:32:00.157858+00
1	387	1160073	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:43:00.017671+00	2025-08-25 09:43:00.019065+00
1	377	1159746	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:33:00.018408+00	2025-08-25 09:33:00.019924+00
1	415	1161029	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:11:00.025733+00	2025-08-25 10:11:00.055765+00
1	396	1160202	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:52:00.014786+00	2025-08-25 09:52:00.016582+00
1	378	1159758	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:34:00.015115+00	2025-08-25 09:34:00.016483+00
1	388	1160086	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:44:00.01459+00	2025-08-25 09:44:00.01591+00
1	379	1159773	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:35:00.014907+00	2025-08-25 09:35:00.016215+00
1	408	1160741	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:04:00.021598+00	2025-08-25 10:04:00.022984+00
1	403	1160486	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:59:00.014048+00	2025-08-25 09:59:00.015426+00
1	389	1160101	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:45:00.01515+00	2025-08-25 09:45:00.016609+00
1	380	1159792	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:36:00.015008+00	2025-08-25 09:36:00.016908+00
1	397	1160215	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:53:00.020554+00	2025-08-25 09:53:00.022041+00
1	381	1159804	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:37:00.014812+00	2025-08-25 09:37:00.016103+00
1	390	1160119	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:46:00.014508+00	2025-08-25 09:46:00.0163+00
1	382	1159817	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:38:00.018722+00	2025-08-25 09:38:00.020112+00
1	412	1160799	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:08:00.018308+00	2025-08-25 10:08:00.019766+00
1	383	1159829	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:39:00.014723+00	2025-08-25 09:39:00.016+00
1	391	1160132	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:47:00.015061+00	2025-08-25 09:47:00.016331+00
1	398	1160227	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:54:00.0149+00	2025-08-25 09:54:00.01626+00
1	384	1159845	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:40:00.015024+00	2025-08-25 09:40:00.016376+00
1	404	1160501	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:00:00.015135+00	2025-08-25 10:00:00.016585+00
1	392	1160145	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:48:00.017005+00	2025-08-25 09:48:00.019272+00
1	399	1160431	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:55:00.103839+00	2025-08-25 09:55:00.148439+00
1	393	1160159	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:49:00.014212+00	2025-08-25 09:49:00.015526+00
1	409	1160756	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:05:00.019278+00	2025-08-25 10:05:00.020645+00
1	405	1160517	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:01:00.015196+00	2025-08-25 10:01:00.016541+00
1	400	1160449	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:56:00.015328+00	2025-08-25 09:56:00.01662+00
1	424	1161155	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:20:00.0153+00	2025-08-25 10:20:00.016798+00
1	418	1161065	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:14:00.016549+00	2025-08-25 10:14:00.017932+00
1	413	1160811	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:09:00.015415+00	2025-08-25 10:09:00.016691+00
1	401	1160461	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 09:57:00.015262+00	2025-08-25 09:57:00.016639+00
1	406	1160529	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:02:00.015026+00	2025-08-25 10:02:00.016504+00
1	410	1160775	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:06:00.014827+00	2025-08-25 10:06:00.016182+00
1	416	1161041	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:12:00.015323+00	2025-08-25 10:12:00.017564+00
1	411	1160787	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:07:00.01452+00	2025-08-25 10:07:00.015893+00
1	414	1160827	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:10:00.014496+00	2025-08-25 10:10:00.0158+00
1	420	1161099	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:16:00.014832+00	2025-08-25 10:16:00.01615+00
1	419	1161080	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:15:00.014304+00	2025-08-25 10:15:00.015675+00
1	417	1161053	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:13:00.016643+00	2025-08-25 10:13:00.018131+00
1	425	1161170	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:21:00.014821+00	2025-08-25 10:21:00.016195+00
1	423	1161140	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:19:00.014663+00	2025-08-25 10:19:00.016033+00
1	422	1161128	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:18:00.017245+00	2025-08-25 10:18:00.018708+00
1	426	1161183	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:22:00.015529+00	2025-08-25 10:22:00.017014+00
1	427	1161383	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:23:00.02354+00	2025-08-25 10:23:00.027767+00
1	428	1161395	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:24:00.014625+00	2025-08-25 10:24:00.015988+00
1	429	1161408	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:25:00.01467+00	2025-08-25 10:25:00.015995+00
1	430	1161429	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:26:00.014507+00	2025-08-25 10:26:00.015893+00
1	431	1161442	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:27:00.015808+00	2025-08-25 10:27:00.017103+00
1	466	1162682	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:02:00.017191+00	2025-08-25 11:02:00.018586+00
1	453	1162125	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:49:00.01503+00	2025-08-25 10:49:00.016297+00
1	432	1161454	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:28:00.019589+00	2025-08-25 10:28:00.02094+00
1	444	1161808	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:40:00.014745+00	2025-08-25 10:40:00.016088+00
1	433	1161467	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:29:00.015288+00	2025-08-25 10:29:00.016719+00
1	480	1163064	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:16:00.015807+00	2025-08-25 11:16:00.017142+00
1	461	1162426	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:57:00.015653+00	2025-08-25 10:57:00.016997+00
1	445	1161826	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:41:00.01587+00	2025-08-25 10:41:00.017301+00
1	434	1161480	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:30:00.013939+00	2025-08-25 10:30:00.015311+00
1	454	1162137	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:50:00.014454+00	2025-08-25 10:50:00.015733+00
1	435	1161498	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:31:00.014236+00	2025-08-25 10:31:00.015596+00
1	446	1161838	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:42:00.014752+00	2025-08-25 10:42:00.016089+00
1	436	1161510	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:32:00.015281+00	2025-08-25 10:32:00.016629+00
1	474	1162790	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:10:00.014683+00	2025-08-25 11:10:00.015986+00
1	455	1162157	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:51:00.014808+00	2025-08-25 10:51:00.016205+00
1	437	1161522	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:33:00.018228+00	2025-08-25 10:33:00.019639+00
1	447	1162040	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:43:00.024279+00	2025-08-25 10:43:00.029131+00
1	438	1161724	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:34:00.018677+00	2025-08-25 10:34:00.030015+00
1	467	1162694	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:03:00.017295+00	2025-08-25 11:03:00.018653+00
1	462	1162439	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:58:00.017341+00	2025-08-25 10:58:00.018857+00
1	448	1162053	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:44:00.014166+00	2025-08-25 10:44:00.016481+00
1	439	1161736	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:35:00.016048+00	2025-08-25 10:35:00.017526+00
1	456	1162169	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:52:00.015934+00	2025-08-25 10:52:00.017312+00
1	440	1161758	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:36:00.015188+00	2025-08-25 10:36:00.016649+00
1	449	1162065	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:45:00.015997+00	2025-08-25 10:45:00.017388+00
1	441	1161771	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:37:00.016438+00	2025-08-25 10:37:00.017779+00
1	471	1162753	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:07:00.015245+00	2025-08-25 11:07:00.016548+00
1	442	1161783	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:38:00.016896+00	2025-08-25 10:38:00.018243+00
1	450	1162086	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:46:00.016465+00	2025-08-25 10:46:00.017766+00
1	457	1162181	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:53:00.017033+00	2025-08-25 10:53:00.018365+00
1	443	1161796	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:39:00.015177+00	2025-08-25 10:39:00.016916+00
1	463	1162451	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:59:00.01532+00	2025-08-25 10:59:00.016635+00
1	451	1162098	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:47:00.014506+00	2025-08-25 10:47:00.015924+00
1	458	1162193	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:54:00.014307+00	2025-08-25 10:54:00.015658+00
1	452	1162111	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:48:00.017113+00	2025-08-25 10:48:00.018483+00
1	468	1162707	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:04:00.016099+00	2025-08-25 11:04:00.017487+00
1	464	1162463	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:00:00.01509+00	2025-08-25 11:00:00.017451+00
1	459	1162392	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:55:00.019675+00	2025-08-25 10:55:00.063452+00
1	483	1163110	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:19:00.014811+00	2025-08-25 11:19:00.016095+00
1	477	1163022	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:13:00.018044+00	2025-08-25 11:13:00.0194+00
1	472	1162766	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:08:00.01803+00	2025-08-25 11:08:00.019461+00
1	460	1162414	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 10:56:00.015188+00	2025-08-25 10:56:00.016492+00
1	465	1162670	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:01:00.015678+00	2025-08-25 11:01:00.018562+00
1	469	1162719	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:05:00.01601+00	2025-08-25 11:05:00.017485+00
1	475	1162805	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:11:00.014749+00	2025-08-25 11:11:00.016079+00
1	470	1162741	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:06:00.014368+00	2025-08-25 11:06:00.016297+00
1	473	1162778	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:09:00.014126+00	2025-08-25 11:09:00.015472+00
1	479	1163046	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:15:00.015045+00	2025-08-25 11:15:00.016396+00
1	478	1163034	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:14:00.015229+00	2025-08-25 11:14:00.016575+00
1	476	1163010	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:12:00.033822+00	2025-08-25 11:12:00.035794+00
1	484	1163122	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:20:00.01484+00	2025-08-25 11:20:00.016171+00
1	482	1163098	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:18:00.018795+00	2025-08-25 11:18:00.020144+00
1	481	1163081	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:17:00.014799+00	2025-08-25 11:17:00.016059+00
1	485	1163137	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:21:00.014617+00	2025-08-25 11:21:00.016086+00
1	486	1163342	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:22:00.019132+00	2025-08-25 11:22:00.021691+00
1	487	1163354	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:23:00.017581+00	2025-08-25 11:23:00.018932+00
1	488	1163367	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:24:00.01635+00	2025-08-25 11:24:00.017828+00
1	489	1163380	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:25:00.014345+00	2025-08-25 11:25:00.015676+00
1	490	1163398	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:26:00.014932+00	2025-08-25 11:26:00.016236+00
1	525	1164450	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:01:00.014906+00	2025-08-25 12:01:00.016332+00
1	512	1164082	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:48:00.017357+00	2025-08-25 11:48:00.018703+00
1	491	1163413	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:27:00.018606+00	2025-08-25 11:27:00.019956+00
1	503	1163767	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:39:00.015311+00	2025-08-25 11:39:00.016625+00
1	492	1163426	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:28:00.014869+00	2025-08-25 11:28:00.016158+00
1	539	1165018	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:15:00.014301+00	2025-08-25 12:15:00.015686+00
1	520	1164382	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:56:00.015826+00	2025-08-25 11:56:00.017139+00
1	504	1163779	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:40:00.01493+00	2025-08-25 11:40:00.01622+00
1	493	1163438	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:29:00.014721+00	2025-08-25 11:29:00.016024+00
1	513	1164096	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:49:00.014435+00	2025-08-25 11:49:00.015724+00
1	494	1163450	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:30:00.014844+00	2025-08-25 11:30:00.016233+00
1	505	1163794	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:41:00.016113+00	2025-08-25 11:41:00.017497+00
1	495	1163466	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:31:00.014671+00	2025-08-25 11:31:00.015944+00
1	533	1164749	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:09:00.014875+00	2025-08-25 12:09:00.016257+00
1	514	1164108	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:50:00.01437+00	2025-08-25 11:50:00.016541+00
1	496	1163482	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:32:00.014816+00	2025-08-25 11:32:00.016125+00
1	506	1163809	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:42:00.014782+00	2025-08-25 11:42:00.016127+00
1	497	1163683	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:33:00.1046+00	2025-08-25 11:33:00.112335+00
1	526	1164462	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:02:00.015634+00	2025-08-25 12:02:00.016986+00
1	521	1164394	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:57:00.016072+00	2025-08-25 11:57:00.017384+00
1	507	1163821	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:43:00.019909+00	2025-08-25 11:43:00.021253+00
1	498	1163695	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:34:00.018276+00	2025-08-25 11:34:00.020601+00
1	515	1164166	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:51:00.020854+00	2025-08-25 11:51:00.022599+00
1	499	1163707	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:35:00.014919+00	2025-08-25 11:35:00.016274+00
1	508	1163834	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:44:00.014615+00	2025-08-25 11:44:00.015945+00
1	500	1163725	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:36:00.014915+00	2025-08-25 11:36:00.016196+00
1	530	1164708	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:06:00.015498+00	2025-08-25 12:06:00.016878+00
1	501	1163741	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:37:00.016334+00	2025-08-25 11:37:00.017763+00
1	509	1163847	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:45:00.015398+00	2025-08-25 11:45:00.016832+00
1	516	1164324	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:52:00.017268+00	2025-08-25 11:52:00.020069+00
1	502	1163755	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:38:00.019015+00	2025-08-25 11:38:00.020323+00
1	522	1164409	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:58:00.01734+00	2025-08-25 11:58:00.018741+00
1	510	1164053	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:46:00.01773+00	2025-08-25 11:46:00.028902+00
1	517	1164340	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:53:00.015811+00	2025-08-25 11:53:00.017125+00
1	511	1164069	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:47:00.015533+00	2025-08-25 11:47:00.016925+00
1	527	1164478	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:03:00.01824+00	2025-08-25 12:03:00.019922+00
1	523	1164422	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:59:00.014806+00	2025-08-25 11:59:00.016073+00
1	518	1164352	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:54:00.014557+00	2025-08-25 11:54:00.015878+00
1	542	1165064	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:18:00.016864+00	2025-08-25 12:18:00.018221+00
1	536	1164976	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:12:00.015053+00	2025-08-25 12:12:00.016379+00
1	531	1164721	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:07:00.014271+00	2025-08-25 12:07:00.015588+00
1	519	1164364	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 11:55:00.01514+00	2025-08-25 11:55:00.016585+00
1	524	1164435	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:00:00.014463+00	2025-08-25 12:00:00.015749+00
1	528	1164678	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:04:00.085684+00	2025-08-25 12:04:00.08815+00
1	534	1164762	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:10:00.015583+00	2025-08-25 12:10:00.016967+00
1	529	1164690	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:05:00.015488+00	2025-08-25 12:05:00.016824+00
1	532	1164736	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:08:00.018556+00	2025-08-25 12:08:00.019851+00
1	538	1165004	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:14:00.015146+00	2025-08-25 12:14:00.016512+00
1	537	1164988	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:13:00.018068+00	2025-08-25 12:13:00.019712+00
1	535	1164964	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:11:00.095342+00	2025-08-25 12:11:00.105481+00
1	543	1165079	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:19:00.015083+00	2025-08-25 12:19:00.016374+00
1	541	1165048	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:17:00.015559+00	2025-08-25 12:17:00.016952+00
1	540	1165036	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:16:00.014448+00	2025-08-25 12:16:00.015732+00
1	544	1165091	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:20:00.014986+00	2025-08-25 12:20:00.016294+00
1	545	1165108	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:21:00.015794+00	2025-08-25 12:21:00.017659+00
1	546	1165120	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:22:00.0148+00	2025-08-25 12:22:00.016242+00
1	547	1165133	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:23:00.016907+00	2025-08-25 12:23:00.018257+00
1	548	1165334	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:24:00.050598+00	2025-08-25 12:24:00.062818+00
1	549	1165346	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:25:00.014865+00	2025-08-25 12:25:00.016236+00
1	584	1166415	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:00:00.014143+00	2025-08-25 13:00:00.015483+00
1	571	1166044	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:47:00.014326+00	2025-08-25 12:47:00.01575+00
1	550	1165365	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:26:00.018725+00	2025-08-25 12:26:00.02007+00
1	562	1165722	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:38:00.017485+00	2025-08-25 12:38:00.018847+00
1	551	1165378	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:27:00.014544+00	2025-08-25 12:27:00.015859+00
1	598	1166986	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:14:00.037668+00	2025-08-25 13:14:00.043929+00
1	579	1166343	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:55:00.048013+00	2025-08-25 12:55:00.05938+00
1	563	1165737	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:39:00.014939+00	2025-08-25 12:39:00.016272+00
1	552	1165390	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:28:00.017303+00	2025-08-25 12:28:00.018758+00
1	572	1166059	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:48:00.018523+00	2025-08-25 12:48:00.019901+00
1	553	1165406	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:29:00.015571+00	2025-08-25 12:29:00.016878+00
1	564	1165758	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:40:00.014763+00	2025-08-25 12:40:00.016153+00
1	554	1165418	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:30:00.015277+00	2025-08-25 12:30:00.016618+00
1	592	1166716	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:08:00.017884+00	2025-08-25 13:08:00.019229+00
1	573	1166072	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:49:00.015142+00	2025-08-25 12:49:00.016477+00
1	555	1165625	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:31:00.053513+00	2025-08-25 12:31:00.063615+00
1	565	1165773	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:41:00.015679+00	2025-08-25 12:41:00.017144+00
1	556	1165638	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:32:00.016132+00	2025-08-25 12:32:00.017557+00
1	585	1166430	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:01:00.014637+00	2025-08-25 13:01:00.016013+00
1	580	1166361	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:56:00.017793+00	2025-08-25 12:56:00.020177+00
1	566	1165786	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:42:00.015094+00	2025-08-25 12:42:00.016557+00
1	557	1165651	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:33:00.019103+00	2025-08-25 12:33:00.020586+00
1	574	1166087	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:50:00.015622+00	2025-08-25 12:50:00.016932+00
1	558	1165666	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:34:00.014877+00	2025-08-25 12:34:00.016184+00
1	567	1165799	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:43:00.017443+00	2025-08-25 12:43:00.018867+00
1	559	1165678	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:35:00.015242+00	2025-08-25 12:35:00.016616+00
1	589	1166673	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:05:00.015398+00	2025-08-25 13:05:00.016747+00
1	560	1165697	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:36:00.014691+00	2025-08-25 12:36:00.016011+00
1	568	1165811	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:44:00.014711+00	2025-08-25 12:44:00.016149+00
1	575	1166102	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:51:00.015174+00	2025-08-25 12:51:00.016538+00
1	561	1165709	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:37:00.014579+00	2025-08-25 12:37:00.015877+00
1	581	1166373	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:57:00.014518+00	2025-08-25 12:57:00.016844+00
1	569	1166013	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:45:00.070313+00	2025-08-25 12:45:00.085202+00
1	576	1166115	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:52:00.014751+00	2025-08-25 12:52:00.016132+00
1	570	1166032	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:46:00.014748+00	2025-08-25 12:46:00.01622+00
1	586	1166513	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:02:00.014542+00	2025-08-25 13:02:00.016044+00
1	582	1166385	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:58:00.016772+00	2025-08-25 12:58:00.018094+00
1	577	1166128	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:53:00.017142+00	2025-08-25 12:53:00.018524+00
1	601	1167031	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:17:00.015596+00	2025-08-25 13:17:00.017418+00
1	595	1166760	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:11:00.016746+00	2025-08-25 13:11:00.018186+00
1	590	1166691	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:06:00.015194+00	2025-08-25 13:06:00.016571+00
1	578	1166141	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:54:00.016079+00	2025-08-25 12:54:00.017463+00
1	583	1166399	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 12:59:00.015415+00	2025-08-25 12:59:00.016759+00
1	587	1166643	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:03:00.022805+00	2025-08-25 13:03:00.034486+00
1	593	1166728	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:09:00.0146+00	2025-08-25 13:09:00.016375+00
1	588	1166657	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:04:00.015601+00	2025-08-25 13:04:00.01699+00
1	591	1166704	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:07:00.015545+00	2025-08-25 13:07:00.016843+00
1	597	1166785	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:13:00.018482+00	2025-08-25 13:13:00.019849+00
1	596	1166772	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:12:00.015568+00	2025-08-25 13:12:00.017036+00
1	594	1166744	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:10:00.015292+00	2025-08-25 13:10:00.016642+00
1	602	1167047	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:18:00.017783+00	2025-08-25 13:18:00.019466+00
1	600	1167020	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:16:00.014539+00	2025-08-25 13:16:00.015821+00
1	599	1167001	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:15:00.015263+00	2025-08-25 13:15:00.016656+00
1	603	1167058	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:19:00.016888+00	2025-08-25 13:19:00.018293+00
1	604	1167074	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:20:01.016173+00	2025-08-25 13:20:01.017557+00
1	605	1167089	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:21:00.015128+00	2025-08-25 13:21:00.01647+00
1	606	1167292	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:22:00.064931+00	2025-08-25 13:22:00.078358+00
1	607	1167305	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:23:00.019252+00	2025-08-25 13:23:00.020603+00
1	608	1167317	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:24:00.016952+00	2025-08-25 13:24:00.019403+00
1	643	1168376	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:59:00.015049+00	2025-08-25 13:59:00.016403+00
1	630	1168007	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:46:00.014561+00	2025-08-25 13:46:00.015857+00
1	609	1167332	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:25:00.021248+00	2025-08-25 13:25:00.023037+00
1	621	1167691	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:37:00.014631+00	2025-08-25 13:37:00.015946+00
1	610	1167351	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:26:00.015162+00	2025-08-25 13:26:00.016473+00
1	657	1168951	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:13:00.056717+00	2025-08-25 14:13:00.071901+00
1	638	1168305	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:54:00.014728+00	2025-08-25 13:54:00.017142+00
1	622	1167704	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:38:00.015791+00	2025-08-25 13:38:00.017112+00
1	611	1167363	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:27:00.015461+00	2025-08-25 13:27:00.017364+00
1	631	1168019	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:47:00.015287+00	2025-08-25 13:47:00.016638+00
1	612	1167376	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:28:00.016908+00	2025-08-25 13:28:00.018537+00
1	623	1167717	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:39:00.014769+00	2025-08-25 13:39:00.016173+00
1	613	1167389	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:29:00.014349+00	2025-08-25 13:29:00.015657+00
1	651	1168681	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:07:00.01456+00	2025-08-25 14:07:00.015901+00
1	632	1168033	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:48:00.017044+00	2025-08-25 13:48:00.018342+00
1	614	1167404	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:30:00.015762+00	2025-08-25 13:30:00.017093+00
1	624	1167733	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:40:00.015092+00	2025-08-25 13:40:00.016419+00
1	615	1167608	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:31:00.017731+00	2025-08-25 13:31:00.02903+00
1	644	1168388	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:00:00.014305+00	2025-08-25 14:00:00.015663+00
1	639	1168317	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:55:00.014994+00	2025-08-25 13:55:00.016398+00
1	625	1167863	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:41:00.040273+00	2025-08-25 13:41:00.049436+00
1	616	1167621	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:32:00.017503+00	2025-08-25 13:32:00.018894+00
1	633	1168047	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:49:00.015345+00	2025-08-25 13:49:00.016887+00
1	617	1167633	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:33:00.016787+00	2025-08-25 13:33:00.018132+00
1	626	1167948	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:42:00.017288+00	2025-08-25 13:42:00.021246+00
1	618	1167646	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:34:00.016937+00	2025-08-25 13:34:00.018384+00
1	648	1168632	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:04:00.014944+00	2025-08-25 14:04:00.016276+00
1	619	1167661	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:35:00.015195+00	2025-08-25 13:35:00.016577+00
1	627	1167960	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:43:00.016901+00	2025-08-25 13:43:00.018224+00
1	634	1168059	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:50:00.015598+00	2025-08-25 13:50:00.017012+00
1	620	1167679	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:36:00.015251+00	2025-08-25 13:36:00.016592+00
1	640	1168339	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:56:00.015538+00	2025-08-25 13:56:00.016889+00
1	628	1167973	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:44:00.014791+00	2025-08-25 13:44:00.016099+00
1	635	1168077	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:51:00.014062+00	2025-08-25 13:51:00.015366+00
1	629	1167986	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:45:00.01776+00	2025-08-25 13:45:00.019137+00
1	645	1168408	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:01:00.015251+00	2025-08-25 14:01:00.016667+00
1	641	1168351	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:57:00.01563+00	2025-08-25 13:57:00.017074+00
1	636	1168280	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:52:00.134095+00	2025-08-25 13:52:00.188098+00
1	660	1168994	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:16:00.014941+00	2025-08-25 14:16:00.017354+00
1	654	1168719	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:10:00.014849+00	2025-08-25 14:10:00.016172+00
1	649	1168645	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:05:00.015796+00	2025-08-25 14:05:00.017175+00
1	637	1168292	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:53:00.019084+00	2025-08-25 13:53:00.020622+00
1	642	1168364	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 13:58:00.019768+00	2025-08-25 13:58:00.021153+00
1	646	1168420	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:02:00.016009+00	2025-08-25 14:02:00.017567+00
1	652	1168694	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:08:00.016726+00	2025-08-25 14:08:00.018081+00
1	647	1168620	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:03:00.138726+00	2025-08-25 14:03:00.154488+00
1	650	1168663	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:06:00.015581+00	2025-08-25 14:06:00.01786+00
1	656	1168749	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:12:00.014482+00	2025-08-25 14:12:00.015873+00
1	655	1168734	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:11:00.01675+00	2025-08-25 14:11:00.018102+00
1	653	1168707	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:09:00.01472+00	2025-08-25 14:09:00.016129+00
1	661	1169009	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:17:00.015452+00	2025-08-25 14:17:00.016893+00
1	659	1168976	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:15:00.014866+00	2025-08-25 14:15:00.016287+00
1	658	1168963	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:14:00.016015+00	2025-08-25 14:14:00.017394+00
1	662	1169025	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:18:00.018068+00	2025-08-25 14:18:00.019548+00
1	663	1169038	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:19:00.016572+00	2025-08-25 14:19:00.017969+00
1	664	1169051	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:20:00.015474+00	2025-08-25 14:20:00.016899+00
1	665	1169066	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:21:00.016288+00	2025-08-25 14:21:00.017742+00
1	666	1169081	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:22:00.014723+00	2025-08-25 14:22:00.016035+00
1	667	1169144	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:23:00.023594+00	2025-08-25 14:23:00.025231+00
1	702	1170337	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:58:00.019645+00	2025-08-25 14:58:00.02156+00
1	689	1169961	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:45:00.01512+00	2025-08-25 14:45:00.016453+00
1	668	1169294	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:24:00.021408+00	2025-08-25 14:24:00.028722+00
1	680	1169652	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:36:00.014606+00	2025-08-25 14:36:00.015895+00
1	669	1169306	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:25:00.015268+00	2025-08-25 14:25:00.0167+00
1	716	1170718	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:12:00.014812+00	2025-08-25 15:12:00.016119+00
1	697	1170078	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:53:00.018828+00	2025-08-25 14:53:00.020244+00
1	681	1169665	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:37:00.014958+00	2025-08-25 14:37:00.017456+00
1	670	1169325	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:26:00.017269+00	2025-08-25 14:26:00.01883+00
1	690	1169979	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:46:00.016116+00	2025-08-25 14:46:00.017871+00
1	671	1169340	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:27:00.01351+00	2025-08-25 14:27:00.014861+00
1	682	1169680	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:38:00.017325+00	2025-08-25 14:38:00.018691+00
1	672	1169353	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:28:00.0158+00	2025-08-25 14:28:00.017212+00
1	710	1170637	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:06:00.016406+00	2025-08-25 15:06:00.017806+00
1	691	1169992	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:47:00.014558+00	2025-08-25 14:47:00.015946+00
1	673	1169366	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:29:00.014783+00	2025-08-25 14:29:00.016087+00
1	683	1169692	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:39:00.014542+00	2025-08-25 14:39:00.015857+00
1	674	1169378	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:30:00.013919+00	2025-08-25 14:30:00.01527+00
1	703	1170349	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:59:00.014549+00	2025-08-25 14:59:00.015911+00
1	698	1170091	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:54:00.015272+00	2025-08-25 14:54:00.016616+00
1	684	1169705	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:40:00.014604+00	2025-08-25 14:40:00.015943+00
1	675	1169394	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:31:00.015126+00	2025-08-25 14:31:00.016483+00
1	692	1170009	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:48:00.016694+00	2025-08-25 14:48:00.018049+00
1	676	1169593	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:32:00.12017+00	2025-08-25 14:32:00.129634+00
1	685	1169909	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:41:00.097516+00	2025-08-25 14:41:00.137292+00
1	677	1169608	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:33:00.018487+00	2025-08-25 14:33:00.020822+00
1	707	1170592	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:03:00.01753+00	2025-08-25 15:03:00.018903+00
1	678	1169621	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:34:00.015899+00	2025-08-25 14:34:00.017339+00
1	686	1169922	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:42:00.014801+00	2025-08-25 14:42:00.016247+00
1	693	1170022	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:49:00.014758+00	2025-08-25 14:49:00.016138+00
1	679	1169634	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:35:00.014528+00	2025-08-25 14:35:00.015871+00
1	699	1170291	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:55:00.036632+00	2025-08-25 14:55:00.090047+00
1	687	1169937	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:43:00.017881+00	2025-08-25 14:43:00.019236+00
1	694	1170034	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:50:00.015788+00	2025-08-25 14:50:00.017207+00
1	688	1169949	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:44:00.014994+00	2025-08-25 14:44:00.016356+00
1	704	1170362	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:00:00.017763+00	2025-08-25 15:00:00.019167+00
1	700	1170309	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:56:00.01553+00	2025-08-25 14:56:00.016837+00
1	695	1170050	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:51:00.01606+00	2025-08-25 14:51:00.017783+00
1	719	1170944	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:15:00.016856+00	2025-08-25 15:15:00.01825+00
1	713	1170679	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:09:00.014648+00	2025-08-25 15:09:00.016004+00
1	708	1170607	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:04:00.016682+00	2025-08-25 15:04:00.018099+00
1	696	1170062	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:52:00.015729+00	2025-08-25 14:52:00.017115+00
1	701	1170322	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 14:57:00.015267+00	2025-08-25 14:57:00.016651+00
1	705	1170566	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:01:00.050964+00	2025-08-25 15:01:00.065327+00
1	711	1170649	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:07:00.014475+00	2025-08-25 15:07:00.01578+00
1	706	1170579	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:02:00.015096+00	2025-08-25 15:02:00.017515+00
1	709	1170619	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:05:00.015222+00	2025-08-25 15:05:00.016537+00
1	715	1170706	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:11:00.015862+00	2025-08-25 15:11:00.017255+00
1	714	1170691	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:10:00.015743+00	2025-08-25 15:10:00.017295+00
1	712	1170662	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:08:00.016964+00	2025-08-25 15:08:00.018433+00
1	720	1170963	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:16:00.015394+00	2025-08-25 15:16:00.016816+00
1	718	1170931	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:14:00.016487+00	2025-08-25 15:14:00.018072+00
1	717	1170916	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:13:00.032752+00	2025-08-25 15:13:00.04008+00
1	721	1170985	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:17:00.014541+00	2025-08-25 15:17:00.015982+00
1	722	1171038	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:18:00.019356+00	2025-08-25 15:18:00.021336+00
1	723	1171075	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:19:00.015362+00	2025-08-25 15:19:00.01674+00
1	724	1171092	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:20:00.014678+00	2025-08-25 15:20:00.016054+00
1	725	1171116	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:21:00.014924+00	2025-08-25 15:21:00.01638+00
1	726	1171168	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:22:00.015331+00	2025-08-25 15:22:00.02047+00
1	738	1171786	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:34:00.014739+00	2025-08-25 15:34:00.016309+00
1	774	1173109	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:10:00.014522+00	2025-08-25 16:10:00.015932+00
1	727	1171191	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:23:00.015748+00	2025-08-25 15:23:00.0171+00
1	768	1172830	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:04:00.015074+00	2025-08-25 16:04:00.016554+00
1	755	1172387	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:51:00.014919+00	2025-08-25 15:51:00.016416+00
1	739	1171798	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:35:00.014737+00	2025-08-25 15:35:00.016097+00
1	728	1171223	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:24:00.014319+00	2025-08-25 15:24:00.01582+00
1	748	1172211	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:44:00.014985+00	2025-08-25 15:44:00.016411+00
1	729	1171425	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:25:00.098304+00	2025-08-25 15:25:00.10745+00
1	740	1171819	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:36:00.016369+00	2025-08-25 15:36:00.01778+00
1	730	1171451	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:26:00.015085+00	2025-08-25 15:26:00.016442+00
1	765	1172768	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:01:00.015637+00	2025-08-25 16:01:00.017121+00
1	761	1172674	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:57:00.014935+00	2025-08-25 15:57:00.016327+00
1	749	1172227	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:45:00.015333+00	2025-08-25 15:45:00.016848+00
1	731	1171463	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:27:00.016349+00	2025-08-25 15:27:00.017782+00
1	741	1171831	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:37:00.014969+00	2025-08-25 15:37:00.016372+00
1	732	1171487	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:28:00.016926+00	2025-08-25 15:28:00.018307+00
1	756	1172587	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:52:00.16192+00	2025-08-25 15:52:00.173126+00
1	742	1171843	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:38:00.017145+00	2025-08-25 15:38:00.018534+00
1	733	1171507	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:29:00.014959+00	2025-08-25 15:29:00.017335+00
1	750	1172251	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:46:00.014996+00	2025-08-25 15:46:00.016396+00
1	734	1171535	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:30:00.014917+00	2025-08-25 15:30:00.01635+00
1	743	1171857	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:39:00.015111+00	2025-08-25 15:39:00.016474+00
1	735	1171744	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:31:00.061868+00	2025-08-25 15:31:00.069183+00
1	736	1171758	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:32:00.015076+00	2025-08-25 15:32:00.016517+00
1	744	1171881	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:40:00.016917+00	2025-08-25 15:40:00.018454+00
1	751	1172273	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:47:00.014925+00	2025-08-25 15:47:00.016335+00
1	737	1171770	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:33:00.018624+00	2025-08-25 15:33:00.020108+00
1	757	1172599	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:53:00.019843+00	2025-08-25 15:53:00.021261+00
1	745	1172131	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:41:00.052+00	2025-08-25 15:41:00.056427+00
1	762	1172716	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:58:00.017875+00	2025-08-25 15:58:00.019279+00
1	752	1172310	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:48:00.018332+00	2025-08-25 15:48:00.019865+00
1	746	1172146	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:42:00.01478+00	2025-08-25 15:42:00.016169+00
1	777	1173336	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:13:00.031453+00	2025-08-25 16:13:00.036689+00
1	758	1172611	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:54:00.015906+00	2025-08-25 15:54:00.017348+00
1	747	1172173	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:43:00.018314+00	2025-08-25 15:43:00.019884+00
1	753	1172324	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:49:00.014739+00	2025-08-25 15:49:00.016105+00
1	766	1172781	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:02:00.014737+00	2025-08-25 16:02:00.016185+00
1	754	1172359	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:50:00.015524+00	2025-08-25 15:50:00.017009+00
1	763	1172730	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:59:00.015076+00	2025-08-25 15:59:00.01652+00
1	759	1172628	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:55:00.015011+00	2025-08-25 15:55:00.01644+00
1	771	1173068	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:07:00.016297+00	2025-08-25 16:07:00.01779+00
1	769	1172955	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:05:00.021939+00	2025-08-25 16:05:00.030651+00
1	760	1172660	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 15:56:00.014532+00	2025-08-25 15:56:00.015942+00
1	764	1172746	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:00:00.014469+00	2025-08-25 16:00:00.015867+00
1	767	1172817	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:03:00.015904+00	2025-08-25 16:03:00.017325+00
1	773	1173093	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:09:00.015628+00	2025-08-25 16:09:00.016965+00
1	770	1173056	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:06:00.016917+00	2025-08-25 16:06:00.019063+00
1	772	1173081	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:08:00.017944+00	2025-08-25 16:08:00.019464+00
1	778	1173357	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:14:00.01516+00	2025-08-25 16:14:00.016516+00
1	776	1173137	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:12:00.015173+00	2025-08-25 16:12:00.016574+00
1	775	1173125	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:11:00.014965+00	2025-08-25 16:11:00.016404+00
1	779	1173372	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:15:00.015368+00	2025-08-25 16:15:00.016788+00
1	780	1173402	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:16:00.014857+00	2025-08-25 16:16:00.016249+00
1	781	1173414	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:17:00.014523+00	2025-08-25 16:17:00.015882+00
1	782	1173431	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:18:00.016845+00	2025-08-25 16:18:00.018267+00
1	783	1173443	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:19:00.0146+00	2025-08-25 16:19:00.015974+00
1	784	1173458	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:20:00.01457+00	2025-08-25 16:20:00.01597+00
1	819	1174760	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:55:00.016828+00	2025-08-25 16:55:00.018337+00
1	806	1174149	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:42:00.01452+00	2025-08-25 16:42:00.015862+00
1	785	1173473	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:21:00.018701+00	2025-08-25 16:21:00.020221+00
1	797	1173833	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:33:00.017337+00	2025-08-25 16:33:00.018744+00
1	786	1173485	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:22:00.015477+00	2025-08-25 16:22:00.016888+00
1	833	1175145	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:09:00.014196+00	2025-08-25 17:09:00.016451+00
1	814	1174454	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:50:00.01496+00	2025-08-25 16:50:00.016356+00
1	798	1174033	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:34:00.10604+00	2025-08-25 16:34:00.116852+00
1	787	1173498	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:23:00.016885+00	2025-08-25 16:23:00.018319+00
1	807	1174349	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:43:00.085946+00	2025-08-25 16:43:00.093772+00
1	788	1173519	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:24:00.015263+00	2025-08-25 16:24:00.016664+00
1	799	1174046	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:35:00.01696+00	2025-08-25 16:35:00.018386+00
1	789	1173722	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:25:00.084735+00	2025-08-25 16:25:00.092646+00
1	827	1174874	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:03:00.018277+00	2025-08-25 17:03:00.019727+00
1	808	1174361	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:44:00.014967+00	2025-08-25 16:44:00.016437+00
1	790	1173740	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:26:00.014925+00	2025-08-25 16:26:00.016265+00
1	800	1174068	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:36:00.014516+00	2025-08-25 16:36:00.01588+00
1	791	1173752	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:27:00.016329+00	2025-08-25 16:27:00.018222+00
1	820	1174781	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:56:00.015277+00	2025-08-25 16:56:00.016737+00
1	815	1174472	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:51:00.016081+00	2025-08-25 16:51:00.017733+00
1	801	1174080	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:37:00.016491+00	2025-08-25 16:37:00.017858+00
1	792	1173765	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:28:00.019076+00	2025-08-25 16:28:00.020564+00
1	809	1174374	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:45:00.014599+00	2025-08-25 16:45:00.015962+00
1	793	1173778	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:29:00.014993+00	2025-08-25 16:29:00.016368+00
1	802	1174092	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:38:00.01806+00	2025-08-25 16:38:00.019427+00
1	794	1173793	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:30:00.014485+00	2025-08-25 16:30:00.015867+00
1	824	1174829	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:00:00.015233+00	2025-08-25 17:00:00.016684+00
1	795	1173809	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:31:00.014293+00	2025-08-25 16:31:00.01573+00
1	803	1174105	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:39:00.015734+00	2025-08-25 16:39:00.017106+00
1	810	1174395	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:46:00.014522+00	2025-08-25 16:46:00.015896+00
1	796	1173821	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:32:00.016731+00	2025-08-25 16:32:00.018895+00
1	816	1174485	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:52:00.014992+00	2025-08-25 16:52:00.016424+00
1	804	1174117	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:40:00.014121+00	2025-08-25 16:40:00.015465+00
1	811	1174414	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:47:00.015216+00	2025-08-25 16:47:00.016757+00
1	805	1174136	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:41:00.016336+00	2025-08-25 16:41:00.0181+00
1	821	1174793	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:57:00.015113+00	2025-08-25 16:57:00.016782+00
1	817	1174497	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:53:00.01733+00	2025-08-25 16:53:00.018969+00
1	812	1174428	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:48:00.018618+00	2025-08-25 16:48:00.020058+00
1	836	1175189	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:12:00.015163+00	2025-08-25 17:12:00.01752+00
1	830	1175108	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:06:00.014693+00	2025-08-25 17:06:00.016121+00
1	825	1174849	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:01:00.015144+00	2025-08-25 17:01:00.016564+00
1	813	1174442	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:49:00.01459+00	2025-08-25 16:49:00.015981+00
1	818	1174698	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:54:00.036118+00	2025-08-25 16:54:00.043524+00
1	822	1174805	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:58:00.017833+00	2025-08-25 16:58:00.019392+00
1	828	1175075	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:04:00.088023+00	2025-08-25 17:04:00.098315+00
1	823	1174817	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 16:59:00.014951+00	2025-08-25 16:59:00.0164+00
1	826	1174862	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:02:00.014517+00	2025-08-25 17:02:00.01597+00
1	832	1175133	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:08:00.019049+00	2025-08-25 17:08:00.020499+00
1	831	1175121	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:07:00.017668+00	2025-08-25 17:07:00.019259+00
1	829	1175087	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:05:00.016426+00	2025-08-25 17:05:00.017875+00
1	837	1175247	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:13:00.091149+00	2025-08-25 17:13:00.095858+00
1	835	1175176	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:11:00.014925+00	2025-08-25 17:11:00.016365+00
1	834	1175157	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:10:00.01464+00	2025-08-25 17:10:00.016042+00
1	838	1175402	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:14:00.020372+00	2025-08-25 17:14:00.030069+00
1	839	1175414	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:15:00.015963+00	2025-08-25 17:15:00.017308+00
1	840	1175435	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:16:00.015719+00	2025-08-25 17:16:00.017124+00
1	841	1175448	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:17:00.015072+00	2025-08-25 17:17:00.016502+00
1	842	1175464	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:18:00.017003+00	2025-08-25 17:18:00.018331+00
1	843	1175476	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:19:00.014967+00	2025-08-25 17:19:00.016336+00
1	878	1176722	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:54:00.014329+00	2025-08-25 17:54:00.01583+00
1	865	1176162	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:41:00.015335+00	2025-08-25 17:41:00.016706+00
1	844	1175489	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:20:00.017708+00	2025-08-25 17:20:00.019141+00
1	856	1176036	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:32:00.015789+00	2025-08-25 17:32:00.017199+00
1	845	1175519	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:21:00.020319+00	2025-08-25 17:21:00.021897+00
1	892	1177110	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:08:00.018462+00	2025-08-25 18:08:00.01984+00
1	873	1176465	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:49:00.014384+00	2025-08-25 17:49:00.015759+00
1	857	1176049	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:33:00.015692+00	2025-08-25 17:33:00.017314+00
1	846	1175708	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:22:00.018103+00	2025-08-25 17:22:00.022751+00
1	866	1176177	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:42:00.01422+00	2025-08-25 17:42:00.015609+00
1	847	1175720	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:23:00.016545+00	2025-08-25 17:23:00.017878+00
1	858	1176061	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:34:00.015064+00	2025-08-25 17:34:00.016427+00
1	848	1175733	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:24:00.015945+00	2025-08-25 17:24:00.018056+00
1	886	1177027	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:02:00.015205+00	2025-08-25 18:02:00.016588+00
1	867	1176190	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:43:00.016854+00	2025-08-25 17:43:00.018182+00
1	849	1175746	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:25:00.014729+00	2025-08-25 17:25:00.016154+00
1	859	1176074	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:35:00.016096+00	2025-08-25 17:35:00.017453+00
1	850	1175764	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:26:00.016277+00	2025-08-25 17:26:00.017806+00
1	879	1176735	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:55:00.014351+00	2025-08-25 17:55:00.016254+00
1	874	1176478	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:50:00.014963+00	2025-08-25 17:50:00.016385+00
1	860	1176093	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:36:00.015321+00	2025-08-25 17:36:00.01764+00
1	851	1175779	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:27:00.014173+00	2025-08-25 17:27:00.015522+00
1	868	1176216	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:44:00.016238+00	2025-08-25 17:44:00.017732+00
1	852	1175791	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:28:00.016911+00	2025-08-25 17:28:00.018206+00
1	861	1176108	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:37:00.015553+00	2025-08-25 17:37:00.017052+00
1	853	1175803	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:29:00.015485+00	2025-08-25 17:29:00.016828+00
1	883	1176793	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:59:00.014296+00	2025-08-25 17:59:00.015611+00
1	854	1175816	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:30:00.014819+00	2025-08-25 17:30:00.016196+00
1	862	1176120	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:38:00.017874+00	2025-08-25 17:38:00.019436+00
1	869	1176404	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:45:00.018874+00	2025-08-25 17:45:00.025918+00
1	855	1176021	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:31:00.181846+00	2025-08-25 17:31:00.189524+00
1	875	1176493	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:51:00.01457+00	2025-08-25 17:51:00.015969+00
1	863	1176133	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:39:00.015305+00	2025-08-25 17:39:00.017184+00
1	870	1176423	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:46:00.015618+00	2025-08-25 17:46:00.01706+00
1	864	1176146	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:40:00.016188+00	2025-08-25 17:40:00.018589+00
1	880	1176754	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:56:00.015203+00	2025-08-25 17:56:00.016573+00
1	876	1176508	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:52:00.014931+00	2025-08-25 17:52:00.016264+00
1	871	1176439	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:47:00.015788+00	2025-08-25 17:47:00.017093+00
1	895	1177187	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:11:00.016557+00	2025-08-25 18:11:00.018094+00
1	889	1177064	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:05:00.014425+00	2025-08-25 18:05:00.01606+00
1	884	1176805	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:00:01.015586+00	2025-08-25 18:00:01.017102+00
1	872	1176452	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:48:00.017806+00	2025-08-25 17:48:00.019185+00
1	877	1176710	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:53:00.03255+00	2025-08-25 17:53:00.041567+00
1	881	1176769	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:57:00.015181+00	2025-08-25 17:57:00.016489+00
1	887	1177039	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:03:00.01783+00	2025-08-25 18:03:00.019154+00
1	882	1176781	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 17:58:00.019216+00	2025-08-25 17:58:00.020568+00
1	885	1177012	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:01:00.014745+00	2025-08-25 18:01:00.020312+00
1	891	1177098	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:07:00.014695+00	2025-08-25 18:07:00.016002+00
1	890	1177082	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:06:00.01431+00	2025-08-25 18:06:00.01563+00
1	888	1177051	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:04:00.014448+00	2025-08-25 18:04:00.015756+00
1	896	1177391	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:12:00.121841+00	2025-08-25 18:12:00.124914+00
1	894	1177168	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:10:00.015851+00	2025-08-25 18:10:00.017493+00
1	893	1177139	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:09:00.024082+00	2025-08-25 18:09:00.026241+00
1	897	1177447	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:13:00.018849+00	2025-08-25 18:13:00.0204+00
1	898	1177459	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:14:00.014931+00	2025-08-25 18:14:00.016524+00
1	899	1177474	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:15:00.015595+00	2025-08-25 18:15:00.017044+00
1	900	1177492	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:16:00.014723+00	2025-08-25 18:16:00.016152+00
1	901	1177508	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:17:00.014521+00	2025-08-25 18:17:00.015876+00
1	902	1177524	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:18:00.018586+00	2025-08-25 18:18:00.020111+00
1	937	1178857	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:53:00.073867+00	2025-08-25 18:53:00.076962+00
1	924	1178250	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:40:00.016234+00	2025-08-25 18:40:00.017617+00
1	903	1177536	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:19:00.017576+00	2025-08-25 18:19:00.019018+00
1	915	1177922	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:31:00.014648+00	2025-08-25 18:31:00.016103+00
1	904	1177555	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:20:00.015197+00	2025-08-25 18:20:00.01662+00
1	951	1179263	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:07:00.017147+00	2025-08-25 19:07:00.018691+00
1	932	1178589	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:48:00.017679+00	2025-08-25 18:48:00.019724+00
1	916	1178136	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:32:00.083008+00	2025-08-25 18:32:00.087645+00
1	905	1177572	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:21:00.015434+00	2025-08-25 18:21:00.016963+00
1	925	1178454	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:41:00.133625+00	2025-08-25 18:41:00.141852+00
1	906	1177597	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:22:00.015099+00	2025-08-25 18:22:00.016532+00
1	917	1178152	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:33:00.019526+00	2025-08-25 18:33:00.021011+00
1	907	1177804	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:23:00.065431+00	2025-08-25 18:23:00.076599+00
1	945	1178977	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:01:00.015027+00	2025-08-25 19:01:00.016575+00
1	926	1178466	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:42:00.015513+00	2025-08-25 18:42:00.017087+00
1	908	1177816	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:24:00.015724+00	2025-08-25 18:24:00.01724+00
1	918	1178164	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:34:00.015992+00	2025-08-25 18:34:00.017463+00
1	909	1177828	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:25:00.014997+00	2025-08-25 18:25:00.016437+00
1	938	1178871	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:54:00.015+00	2025-08-25 18:54:00.016379+00
1	933	1178606	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:49:00.015461+00	2025-08-25 18:49:00.0169+00
1	919	1178176	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:35:00.017113+00	2025-08-25 18:35:00.01869+00
1	910	1177847	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:26:00.014828+00	2025-08-25 18:26:00.016231+00
1	927	1178488	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:43:00.017748+00	2025-08-25 18:43:00.019308+00
1	911	1177859	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:27:00.015349+00	2025-08-25 18:27:00.016834+00
1	920	1178194	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:36:00.014546+00	2025-08-25 18:36:00.015989+00
1	912	1177874	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:28:00.017188+00	2025-08-25 18:28:00.018648+00
1	942	1178933	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:58:00.01782+00	2025-08-25 18:58:00.019225+00
1	913	1177890	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:29:00.014502+00	2025-08-25 18:29:00.015948+00
1	921	1178206	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:37:00.01465+00	2025-08-25 18:37:00.016107+00
1	928	1178514	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:44:00.015049+00	2025-08-25 18:44:00.016525+00
1	914	1177907	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:30:00.014796+00	2025-08-25 18:30:00.016288+00
1	934	1178621	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:50:00.015111+00	2025-08-25 18:50:00.017859+00
1	922	1178223	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:38:00.017848+00	2025-08-25 18:38:00.019293+00
1	929	1178527	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:45:00.015547+00	2025-08-25 18:45:00.017002+00
1	923	1178236	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:39:00.014654+00	2025-08-25 18:39:00.016017+00
1	939	1178883	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:55:00.015101+00	2025-08-25 18:55:00.016525+00
1	935	1178636	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:51:00.015518+00	2025-08-25 18:51:00.017629+00
1	930	1178545	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:46:00.016538+00	2025-08-25 18:46:00.01798+00
1	954	1179308	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:10:00.014703+00	2025-08-25 19:10:00.016209+00
1	948	1179078	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:04:00.01872+00	2025-08-25 19:04:00.021336+00
1	943	1178949	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:59:00.014712+00	2025-08-25 18:59:00.016109+00
1	931	1178572	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:47:00.015251+00	2025-08-25 18:47:00.016735+00
1	936	1178649	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:52:00.015246+00	2025-08-25 18:52:00.016764+00
1	940	1178901	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:56:00.015186+00	2025-08-25 18:56:00.016574+00
1	946	1178989	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:02:00.015769+00	2025-08-25 19:02:00.017205+00
1	941	1178913	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 18:57:00.014767+00	2025-08-25 18:57:00.016119+00
1	944	1178961	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:00:00.014535+00	2025-08-25 19:00:00.015905+00
1	950	1179250	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:06:00.016863+00	2025-08-25 19:06:00.018987+00
1	949	1179232	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:05:00.034063+00	2025-08-25 19:05:00.03718+00
1	947	1179002	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:03:00.017453+00	2025-08-25 19:03:00.018931+00
1	955	1179512	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:11:00.101228+00	2025-08-25 19:11:00.109875+00
1	953	1179294	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:09:00.015477+00	2025-08-25 19:09:00.016887+00
1	952	1179276	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:08:00.016736+00	2025-08-25 19:08:00.018183+00
1	956	1179526	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:12:00.015193+00	2025-08-25 19:12:00.017327+00
1	957	1179540	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:13:00.018341+00	2025-08-25 19:13:00.019788+00
1	958	1179556	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:14:00.015858+00	2025-08-25 19:14:00.017274+00
1	959	1179575	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:15:00.015306+00	2025-08-25 19:15:00.01679+00
1	960	1179593	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:16:00.014532+00	2025-08-25 19:16:00.016307+00
1	961	1179605	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:17:00.014457+00	2025-08-25 19:17:00.015966+00
1	996	1181003	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:52:00.1276+00	2025-08-25 19:52:00.136859+00
1	983	1180336	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:39:00.015022+00	2025-08-25 19:39:00.017158+00
1	962	1179621	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:18:00.018903+00	2025-08-25 19:18:00.020311+00
1	974	1179978	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:30:00.014941+00	2025-08-25 19:30:00.016295+00
1	963	1179637	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:19:00.014854+00	2025-08-25 19:19:00.016292+00
1	1010	1181419	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:06:00.017403+00	2025-08-25 20:06:00.020919+00
1	991	1180741	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:47:00.014323+00	2025-08-25 19:47:00.01577+00
1	975	1179994	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:31:00.015186+00	2025-08-25 19:31:00.016584+00
1	964	1179650	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:20:00.014942+00	2025-08-25 19:20:00.016362+00
1	984	1180358	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:40:00.015013+00	2025-08-25 19:40:00.01769+00
1	965	1179665	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:21:00.015348+00	2025-08-25 19:21:00.016814+00
1	976	1180006	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:32:00.014462+00	2025-08-25 19:32:00.015814+00
1	966	1179677	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:22:00.015084+00	2025-08-25 19:22:00.016495+00
1	1004	1181112	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:00:00.015204+00	2025-08-25 20:00:00.016619+00
1	985	1180374	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:41:00.015243+00	2025-08-25 19:41:00.016707+00
1	967	1179689	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:23:00.017023+00	2025-08-25 19:23:00.018439+00
1	977	1180019	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:33:00.017631+00	2025-08-25 19:33:00.019049+00
1	968	1179705	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:24:00.015388+00	2025-08-25 19:24:00.016854+00
1	997	1181016	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:53:00.019865+00	2025-08-25 19:53:00.02133+00
1	992	1180754	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:48:00.018207+00	2025-08-25 19:48:00.019655+00
1	978	1180040	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:34:00.014786+00	2025-08-25 19:34:00.016184+00
1	969	1179908	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:25:00.129672+00	2025-08-25 19:25:00.138558+00
1	986	1180596	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:42:00.029459+00	2025-08-25 19:42:00.030991+00
1	970	1179926	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:26:00.016348+00	2025-08-25 19:26:00.017785+00
1	979	1180070	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:35:00.017316+00	2025-08-25 19:35:00.019716+00
1	971	1179938	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:27:00.014858+00	2025-08-25 19:27:00.016355+00
1	1001	1181075	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:57:00.01421+00	2025-08-25 19:57:00.015656+00
1	972	1179950	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:28:00.01716+00	2025-08-25 19:28:00.018533+00
1	980	1180263	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:36:00.030037+00	2025-08-25 19:36:00.034755+00
1	987	1180622	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:43:00.018097+00	2025-08-25 19:43:00.02051+00
1	973	1179962	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:29:00.015215+00	2025-08-25 19:29:00.016541+00
1	993	1180769	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:49:00.01505+00	2025-08-25 19:49:00.016468+00
1	981	1180277	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:37:00.014598+00	2025-08-25 19:37:00.016753+00
1	988	1180634	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:44:00.015399+00	2025-08-25 19:44:00.016878+00
1	982	1180306	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:38:00.019941+00	2025-08-25 19:38:00.022799+00
1	998	1181029	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:54:00.014686+00	2025-08-25 19:54:00.01616+00
1	994	1180785	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:50:00.014605+00	2025-08-25 19:50:00.016045+00
1	989	1180673	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:45:00.014752+00	2025-08-25 19:45:00.01621+00
1	1013	1181457	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:09:00.015664+00	2025-08-25 20:09:00.017283+00
1	1007	1181162	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:03:00.017215+00	2025-08-25 20:03:00.018747+00
1	1002	1181087	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:58:00.017429+00	2025-08-25 19:58:00.018973+00
1	990	1180700	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:46:00.016096+00	2025-08-25 19:46:00.018111+00
1	995	1180800	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:51:00.015677+00	2025-08-25 19:51:00.017304+00
1	999	1181041	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:55:00.016212+00	2025-08-25 19:55:00.017707+00
1	1005	1181130	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:01:00.015181+00	2025-08-25 20:01:00.016626+00
1	1000	1181062	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:56:00.016201+00	2025-08-25 19:56:00.017851+00
1	1003	1181099	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 19:59:00.017328+00	2025-08-25 19:59:00.018802+00
1	1009	1181393	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:05:00.016809+00	2025-08-25 20:05:00.01923+00
1	1008	1181293	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:04:00.028583+00	2025-08-25 20:04:00.036131+00
1	1006	1181149	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:02:00.015215+00	2025-08-25 20:02:00.016658+00
1	1014	1181472	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:10:00.014843+00	2025-08-25 20:10:00.016269+00
1	1012	1181445	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:08:00.01705+00	2025-08-25 20:08:00.018682+00
1	1011	1181433	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:07:00.014998+00	2025-08-25 20:07:00.0166+00
1	1015	1181490	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:11:00.015193+00	2025-08-25 20:11:00.01665+00
1	1016	1181502	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:12:00.014541+00	2025-08-25 20:12:00.015979+00
1	1017	1181704	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:13:00.047355+00	2025-08-25 20:13:00.05152+00
1	1018	1181716	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:14:00.018161+00	2025-08-25 20:14:00.020731+00
1	1019	1181736	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:15:00.015988+00	2025-08-25 20:15:00.01743+00
1	1020	1181766	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:16:00.014594+00	2025-08-25 20:16:00.016047+00
1	1055	1182817	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:51:00.014955+00	2025-08-25 20:51:00.016471+00
1	1042	1182447	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:38:00.018267+00	2025-08-25 20:38:00.019836+00
1	1021	1181778	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:17:00.018918+00	2025-08-25 20:17:00.020358+00
1	1033	1182132	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:29:00.014109+00	2025-08-25 20:29:00.015516+00
1	1022	1181794	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:18:00.017104+00	2025-08-25 20:18:00.018612+00
1	1069	1183383	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:05:00.019322+00	2025-08-25 21:05:00.021075+00
1	1050	1182747	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:46:00.016209+00	2025-08-25 20:46:00.017682+00
1	1034	1182145	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:30:00.014644+00	2025-08-25 20:30:00.016981+00
1	1023	1181807	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:19:00.01444+00	2025-08-25 20:19:00.01582+00
1	1043	1182459	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:39:00.014492+00	2025-08-25 20:39:00.01584+00
1	1024	1181819	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:20:00.01589+00	2025-08-25 20:20:00.017577+00
1	1035	1182160	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:31:00.014953+00	2025-08-25 20:31:00.016393+00
1	1025	1181837	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:21:00.015495+00	2025-08-25 20:21:00.017024+00
1	1063	1183114	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:59:00.015893+00	2025-08-25 20:59:00.017301+00
1	1044	1182472	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:40:00.014529+00	2025-08-25 20:40:00.015931+00
1	1026	1181849	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:22:00.014622+00	2025-08-25 20:22:00.016143+00
1	1036	1182175	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:32:00.014535+00	2025-08-25 20:32:00.015978+00
1	1027	1181862	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:23:00.01672+00	2025-08-25 20:23:00.018194+00
1	1056	1182832	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:52:00.015689+00	2025-08-25 20:52:00.017209+00
1	1051	1182762	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:47:00.016158+00	2025-08-25 20:47:00.017658+00
1	1037	1182188	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:33:00.016873+00	2025-08-25 20:33:00.018429+00
1	1028	1181874	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:24:00.015106+00	2025-08-25 20:24:00.016523+00
1	1045	1182488	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:41:00.015703+00	2025-08-25 20:41:00.017194+00
1	1029	1181901	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:25:00.014806+00	2025-08-25 20:25:00.01635+00
1	1038	1182389	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:34:00.078288+00	2025-08-25 20:34:00.129305+00
1	1030	1182093	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:26:00.026208+00	2025-08-25 20:26:00.029953+00
1	1060	1183075	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:56:00.015087+00	2025-08-25 20:56:00.016463+00
1	1031	1182108	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:27:00.015101+00	2025-08-25 20:27:00.016554+00
1	1039	1182402	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:35:00.017956+00	2025-08-25 20:35:00.019406+00
1	1046	1182504	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:42:00.016099+00	2025-08-25 20:42:00.017771+00
1	1032	1182120	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:28:00.017459+00	2025-08-25 20:28:00.019012+00
1	1052	1182776	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:48:00.017529+00	2025-08-25 20:48:00.018964+00
1	1040	1182420	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:36:00.015031+00	2025-08-25 20:36:00.016787+00
1	1047	1182704	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:43:00.141292+00	2025-08-25 20:43:00.179842+00
1	1041	1182435	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:37:00.014421+00	2025-08-25 20:37:00.015773+00
1	1057	1182844	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:53:00.018309+00	2025-08-25 20:53:00.019952+00
1	1053	1182790	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:49:00.01529+00	2025-08-25 20:49:00.01673+00
1	1048	1182716	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:44:00.015153+00	2025-08-25 20:44:00.016733+00
1	1072	1183431	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:08:00.018305+00	2025-08-25 21:08:00.020602+00
1	1066	1183154	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:02:00.015803+00	2025-08-25 21:02:00.017232+00
1	1061	1183090	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:57:00.014505+00	2025-08-25 20:57:00.015898+00
1	1049	1182728	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:45:00.015586+00	2025-08-25 20:45:00.017018+00
1	1054	1182802	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:50:00.015292+00	2025-08-25 20:50:00.016783+00
1	1058	1182857	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:54:00.015686+00	2025-08-25 20:54:00.017108+00
1	1064	1183127	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:00:00.017753+00	2025-08-25 21:00:00.019274+00
1	1059	1183057	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:55:00.025725+00	2025-08-25 20:55:00.040684+00
1	1062	1183102	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 20:58:00.01808+00	2025-08-25 20:58:00.0196+00
1	1068	1183371	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:04:00.014863+00	2025-08-25 21:04:00.017196+00
1	1067	1183359	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:03:00.078736+00	2025-08-25 21:03:00.126471+00
1	1065	1183142	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:01:00.015242+00	2025-08-25 21:01:00.016707+00
1	1073	1183444	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:09:00.01485+00	2025-08-25 21:09:00.01618+00
1	1071	1183416	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:07:00.014522+00	2025-08-25 21:07:00.015917+00
1	1070	1183402	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:06:00.016022+00	2025-08-25 21:06:00.017476+00
1	1074	1183456	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:10:00.014516+00	2025-08-25 21:10:00.01593+00
1	1075	1183472	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:11:00.014283+00	2025-08-25 21:11:00.015694+00
1	1076	1183484	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:12:00.015919+00	2025-08-25 21:12:00.017335+00
1	1077	1183499	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:13:00.018527+00	2025-08-25 21:13:00.01992+00
1	1078	1183511	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:14:00.015082+00	2025-08-25 21:14:00.016458+00
1	1079	1183566	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:15:00.016697+00	2025-08-25 21:15:00.019598+00
1	1114	1184774	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:50:00.014156+00	2025-08-25 21:50:00.015615+00
1	1101	1184398	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:37:00.015638+00	2025-08-25 21:37:00.017071+00
1	1080	1183728	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:16:00.023137+00	2025-08-25 21:16:00.029436+00
1	1092	1184085	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:28:00.019668+00	2025-08-25 21:28:00.021988+00
1	1081	1183740	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:17:00.014842+00	2025-08-25 21:17:00.016342+00
1	1128	1185157	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:04:00.014631+00	2025-08-25 22:04:00.016048+00
1	1109	1184701	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:45:00.014293+00	2025-08-25 21:45:00.015783+00
1	1093	1184098	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:29:00.015185+00	2025-08-25 21:29:00.016578+00
1	1082	1183760	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:18:00.016263+00	2025-08-25 21:18:00.018129+00
1	1102	1184411	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:38:00.018483+00	2025-08-25 21:38:00.019922+00
1	1083	1183772	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:19:00.014846+00	2025-08-25 21:19:00.016398+00
1	1094	1184111	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:30:00.016202+00	2025-08-25 21:30:00.017599+00
1	1084	1183784	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:20:00.015313+00	2025-08-25 21:20:00.016761+00
1	1122	1185073	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:58:00.017821+00	2025-08-25 21:58:00.019304+00
1	1103	1184427	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:39:00.01507+00	2025-08-25 21:39:00.016523+00
1	1085	1183799	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:21:00.014446+00	2025-08-25 21:21:00.015869+00
1	1095	1184126	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:31:00.014535+00	2025-08-25 21:31:00.015975+00
1	1086	1183999	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:22:00.040989+00	2025-08-25 21:22:00.063174+00
1	1115	1184977	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:51:00.055994+00	2025-08-25 21:51:00.062321+00
1	1110	1184719	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:46:00.01481+00	2025-08-25 21:46:00.016263+00
1	1096	1184139	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:32:00.015425+00	2025-08-25 21:32:00.016865+00
1	1087	1184014	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:23:00.018625+00	2025-08-25 21:23:00.020081+00
1	1104	1184439	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:40:00.015287+00	2025-08-25 21:40:00.01672+00
1	1088	1184027	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:24:00.015573+00	2025-08-25 21:24:00.017999+00
1	1097	1184151	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:33:00.020167+00	2025-08-25 21:33:00.021671+00
1	1089	1184039	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:25:00.015468+00	2025-08-25 21:25:00.016934+00
1	1119	1185031	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:55:00.015064+00	2025-08-25 21:55:00.016528+00
1	1090	1184058	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:26:00.015972+00	2025-08-25 21:26:00.018456+00
1	1098	1184166	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:34:00.015279+00	2025-08-25 21:34:00.016665+00
1	1105	1184463	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:41:00.015267+00	2025-08-25 21:41:00.016705+00
1	1091	1184070	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:27:00.014272+00	2025-08-25 21:27:00.015642+00
1	1111	1184732	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:47:00.014866+00	2025-08-25 21:47:00.016252+00
1	1099	1184319	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:35:00.141013+00	2025-08-25 21:35:00.154942+00
1	1106	1184475	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:42:00.015094+00	2025-08-25 21:42:00.016627+00
1	1100	1184386	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:36:00.014537+00	2025-08-25 21:36:00.016081+00
1	1116	1184989	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:52:00.017418+00	2025-08-25 21:52:00.018892+00
1	1112	1184746	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:48:00.019674+00	2025-08-25 21:48:00.021363+00
1	1107	1184487	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:43:00.016497+00	2025-08-25 21:43:00.017999+00
1	1131	1185390	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:07:00.01498+00	2025-08-25 22:07:00.016439+00
1	1125	1185117	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:01:00.017337+00	2025-08-25 22:01:00.01972+00
1	1120	1185049	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:56:00.015208+00	2025-08-25 21:56:00.01662+00
1	1108	1184689	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:44:00.135588+00	2025-08-25 21:44:00.178483+00
1	1113	1184762	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:49:00.014953+00	2025-08-25 21:49:00.016401+00
1	1117	1185001	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:53:00.018095+00	2025-08-25 21:53:00.019665+00
1	1123	1185088	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:59:00.014581+00	2025-08-25 21:59:00.016046+00
1	1118	1185017	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:54:00.017103+00	2025-08-25 21:54:00.018576+00
1	1121	1185061	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 21:57:00.015961+00	2025-08-25 21:57:00.017366+00
1	1127	1185142	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:03:00.016735+00	2025-08-25 22:03:00.019168+00
1	1126	1185129	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:02:00.015748+00	2025-08-25 22:02:00.017415+00
1	1124	1185102	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:00:00.014744+00	2025-08-25 22:00:00.016129+00
1	1132	1185402	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:08:00.017202+00	2025-08-25 22:08:00.018768+00
1	1130	1185378	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:06:00.015181+00	2025-08-25 22:06:00.016625+00
1	1129	1185358	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:05:00.03573+00	2025-08-25 22:05:00.04318+00
1	1133	1185415	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:09:00.016353+00	2025-08-25 22:09:00.01776+00
1	1134	1185430	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:10:00.015134+00	2025-08-25 22:10:00.016561+00
1	1135	1185446	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:11:00.014586+00	2025-08-25 22:11:00.01601+00
1	1136	1185646	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:12:00.080971+00	2025-08-25 22:12:00.088163+00
1	1137	1185658	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:13:00.017545+00	2025-08-25 22:13:00.018985+00
1	1138	1185670	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:14:00.014841+00	2025-08-25 22:14:00.017913+00
1	1173	1186732	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:49:00.014997+00	2025-08-25 22:49:00.016422+00
1	1160	1186366	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:36:00.015114+00	2025-08-25 22:36:00.016501+00
1	1139	1185686	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:15:00.022741+00	2025-08-25 22:15:00.024157+00
1	1151	1186049	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:27:00.01508+00	2025-08-25 22:27:00.016452+00
1	1140	1185706	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:16:00.014697+00	2025-08-25 22:16:00.016124+00
1	1187	1187117	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:03:00.016731+00	2025-08-25 23:03:00.018258+00
1	1168	1186659	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:44:00.014619+00	2025-08-25 22:44:00.016033+00
1	1152	1186061	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:28:00.015153+00	2025-08-25 22:28:00.016532+00
1	1141	1185718	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:17:00.014726+00	2025-08-25 22:17:00.016225+00
1	1161	1186378	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:37:00.017199+00	2025-08-25 22:37:00.019588+00
1	1142	1185735	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:18:00.017809+00	2025-08-25 22:18:00.019328+00
1	1153	1186074	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:29:00.016192+00	2025-08-25 22:29:00.017745+00
1	1143	1185747	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:19:00.014085+00	2025-08-25 22:19:00.015488+00
1	1181	1187037	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:57:00.015733+00	2025-08-25 22:57:00.017125+00
1	1162	1186391	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:38:00.015848+00	2025-08-25 22:38:00.017292+00
1	1144	1185762	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:20:00.014179+00	2025-08-25 22:20:00.015591+00
1	1154	1186089	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:30:00.014677+00	2025-08-25 22:30:00.016183+00
1	1145	1185777	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:21:00.014813+00	2025-08-25 22:21:00.016224+00
1	1174	1186748	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:50:00.015356+00	2025-08-25 22:50:00.016836+00
1	1169	1186674	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:45:00.014594+00	2025-08-25 22:45:00.016468+00
1	1155	1186295	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:31:00.080137+00	2025-08-25 22:31:00.112385+00
1	1146	1185790	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:22:00.015272+00	2025-08-25 22:22:00.016712+00
1	1163	1186403	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:39:00.017085+00	2025-08-25 22:39:00.018479+00
1	1147	1185802	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:23:00.017041+00	2025-08-25 22:23:00.018529+00
1	1156	1186307	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:32:00.016493+00	2025-08-25 22:32:00.017924+00
1	1148	1186003	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:24:00.054095+00	2025-08-25 22:24:00.063793+00
1	1178	1186801	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:54:00.015233+00	2025-08-25 22:54:00.016647+00
1	1149	1186018	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:25:00.015479+00	2025-08-25 22:25:00.016831+00
1	1157	1186320	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:33:00.01812+00	2025-08-25 22:33:00.019586+00
1	1164	1186418	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:40:00.016068+00	2025-08-25 22:40:00.017654+00
1	1150	1186036	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:26:00.015656+00	2025-08-25 22:26:00.017045+00
1	1170	1186692	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:46:00.014806+00	2025-08-25 22:46:00.016289+00
1	1158	1186332	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:34:00.014244+00	2025-08-25 22:34:00.01632+00
1	1165	1186622	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:41:00.061242+00	2025-08-25 22:41:00.129572+00
1	1159	1186348	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:35:00.015206+00	2025-08-25 22:35:00.016639+00
1	1175	1186763	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:51:00.015168+00	2025-08-25 22:51:00.016546+00
1	1171	1186706	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:47:00.01434+00	2025-08-25 22:47:00.0158+00
1	1166	1186634	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:42:00.015927+00	2025-08-25 22:42:00.017663+00
1	1190	1187351	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:06:00.014195+00	2025-08-25 23:06:00.015584+00
1	1184	1187077	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:00:00.014907+00	2025-08-25 23:00:00.016264+00
1	1179	1187006	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:55:00.040676+00	2025-08-25 22:55:00.050942+00
1	1167	1186646	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:43:00.017725+00	2025-08-25 22:43:00.019147+00
1	1172	1186719	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:48:00.016527+00	2025-08-25 22:48:00.018047+00
1	1176	1186775	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:52:00.015818+00	2025-08-25 22:52:00.017288+00
1	1182	1187049	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:58:00.019357+00	2025-08-25 22:58:00.020804+00
1	1177	1186787	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:53:00.017166+00	2025-08-25 22:53:00.018634+00
1	1180	1187025	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:56:00.015349+00	2025-08-25 22:56:00.017107+00
1	1186	1187104	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:02:00.01543+00	2025-08-25 23:02:00.016933+00
1	1185	1187092	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:01:00.015116+00	2025-08-25 23:01:00.016587+00
1	1183	1187061	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 22:59:00.015312+00	2025-08-25 22:59:00.016723+00
1	1191	1187363	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:07:00.014553+00	2025-08-25 23:07:00.015982+00
1	1189	1187329	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:05:00.014185+00	2025-08-25 23:05:00.015601+00
1	1188	1187317	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:04:00.030735+00	2025-08-25 23:04:00.041582+00
1	1192	1187375	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:08:00.016943+00	2025-08-25 23:08:00.018344+00
1	1193	1187387	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:09:00.016847+00	2025-08-25 23:09:00.018229+00
1	1194	1187399	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:10:01.016095+00	2025-08-25 23:10:01.017531+00
1	1195	1187418	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:11:00.014819+00	2025-08-25 23:11:00.016576+00
1	1196	1187430	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:12:00.015807+00	2025-08-25 23:12:00.017255+00
1	1197	1187442	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:13:00.018149+00	2025-08-25 23:13:00.01966+00
1	1232	1188689	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:48:00.018523+00	2025-08-25 23:48:00.019898+00
1	1219	1188313	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:35:00.049354+00	2025-08-25 23:35:00.07889+00
1	1198	1187455	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:14:00.018362+00	2025-08-25 23:14:00.019775+00
1	1210	1188006	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:26:00.016064+00	2025-08-25 23:26:00.017439+00
1	1199	1187655	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:15:00.01618+00	2025-08-25 23:15:00.060251+00
3	1247	1189051	postgres	postgres	 select refresh_analytics(); 	succeeded	1 row	2025-08-26 00:00:00.034215+00	2025-08-26 00:00:00.332787+00
1	1227	1188617	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:43:00.019252+00	2025-08-25 23:43:00.021599+00
1	1211	1188018	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:27:00.014852+00	2025-08-25 23:27:00.016221+00
1	1200	1187676	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:16:00.015216+00	2025-08-25 23:16:00.016693+00
1	1220	1188336	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:36:00.015359+00	2025-08-25 23:36:00.017085+00
1	1201	1187689	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:17:00.015532+00	2025-08-25 23:17:00.017005+00
1	1212	1188032	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:28:00.017785+00	2025-08-25 23:28:00.019435+00
1	1202	1187705	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:18:00.016935+00	2025-08-25 23:18:00.018329+00
1	1240	1188992	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:56:00.017014+00	2025-08-25 23:56:00.018406+00
1	1221	1188348	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:37:00.015657+00	2025-08-25 23:37:00.017066+00
1	1203	1187718	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:19:00.014921+00	2025-08-25 23:19:00.016334+00
1	1213	1188044	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:29:00.015561+00	2025-08-25 23:29:00.018013+00
1	1204	1187731	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:20:00.015115+00	2025-08-25 23:20:00.016482+00
1	1233	1188702	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:49:00.014971+00	2025-08-25 23:49:00.016334+00
1	1228	1188630	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:44:00.015976+00	2025-08-25 23:44:00.017551+00
1	1214	1188056	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:30:00.014741+00	2025-08-25 23:30:00.016169+00
1	1205	1187936	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:21:00.043707+00	2025-08-25 23:21:00.056949+00
1	1222	1188361	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:38:00.017009+00	2025-08-25 23:38:00.018454+00
1	1206	1187948	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:22:00.01569+00	2025-08-25 23:22:00.01714+00
1	1215	1188075	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:31:00.016663+00	2025-08-25 23:31:00.018112+00
1	1207	1187960	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:23:00.019547+00	2025-08-25 23:23:00.021289+00
1	1237	1188758	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:53:00.018357+00	2025-08-25 23:53:00.019779+00
1	1208	1187973	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:24:00.014864+00	2025-08-25 23:24:00.016261+00
1	1216	1188087	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:32:00.014494+00	2025-08-25 23:32:00.015919+00
1	1223	1188373	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:39:00.014967+00	2025-08-25 23:39:00.016308+00
1	1209	1187985	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:25:00.014864+00	2025-08-25 23:25:00.016321+00
1	1229	1188642	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:45:00.015496+00	2025-08-25 23:45:00.016943+00
1	1217	1188099	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:33:00.017232+00	2025-08-25 23:33:00.018765+00
1	1224	1188385	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:40:00.014839+00	2025-08-25 23:40:00.016244+00
1	1218	1188111	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:34:00.014535+00	2025-08-25 23:34:00.015948+00
1	1234	1188716	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:50:00.015973+00	2025-08-25 23:50:00.017386+00
1	1230	1188663	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:46:00.014663+00	2025-08-25 23:46:00.016058+00
1	1225	1188592	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:41:00.04207+00	2025-08-25 23:41:00.050805+00
1	1243	1189031	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:59:00.015164+00	2025-08-25 23:59:00.016509+00
1	1238	1188959	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:54:00.061753+00	2025-08-25 23:54:00.085622+00
1	1226	1188605	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:42:00.017112+00	2025-08-25 23:42:00.018873+00
1	1231	1188676	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:47:00.015396+00	2025-08-25 23:47:00.016865+00
1	1235	1188731	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:51:00.014988+00	2025-08-25 23:51:00.016409+00
1	1241	1189007	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:57:00.01538+00	2025-08-25 23:57:00.016778+00
1	1236	1188746	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:52:00.015642+00	2025-08-25 23:52:00.017059+00
1	1239	1188973	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:55:00.017543+00	2025-08-25 23:55:00.019012+00
1	1250	1189094	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:03:00.018751+00	2025-08-26 00:03:00.020241+00
1	1242	1189019	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-25 23:58:00.017799+00	2025-08-25 23:58:00.019227+00
1	1248	1189067	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:01:00.014358+00	2025-08-26 00:01:00.015858+00
1	1249	1189082	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:02:00.015905+00	2025-08-26 00:02:00.017422+00
1	1251	1189107	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:04:00.014791+00	2025-08-26 00:04:00.016385+00
1	1246	1189050	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:00:00.042651+00	2025-08-26 00:00:00.044121+00
6	1245	1189049	postgres	postgres	refresh materialized view mv_winners_report;	succeeded	REFRESH MATERIALIZED VIEW	2025-08-26 00:00:00.035354+00	2025-08-26 00:00:00.230607+00
8	1244	1189048	postgres	postgres	refresh materialized view concurrently mv_winners_report;	succeeded	REFRESH MATERIALIZED VIEW	2025-08-26 00:00:00.030892+00	2025-08-26 00:00:00.271581+00
1	1252	1189307	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:05:00.040912+00	2025-08-26 00:05:00.070609+00
1	1253	1189327	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:06:00.014789+00	2025-08-26 00:06:00.016349+00
1	1254	1189342	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:07:00.016441+00	2025-08-26 00:07:00.018049+00
1	1255	1189355	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:08:00.018385+00	2025-08-26 00:08:00.019863+00
1	1290	1190413	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:43:00.016334+00	2025-08-26 00:43:00.017692+00
1	1277	1190041	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:30:00.014334+00	2025-08-26 00:30:00.015747+00
1	1256	1189367	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:09:00.018462+00	2025-08-26 00:09:00.019882+00
1	1268	1189725	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:21:00.015126+00	2025-08-26 00:21:00.01657+00
1	1257	1189379	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:10:00.015628+00	2025-08-26 00:10:00.017088+00
1	1304	1190988	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:57:00.016164+00	2025-08-26 00:57:00.017519+00
1	1285	1190344	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:38:00.016002+00	2025-08-26 00:38:00.017348+00
1	1269	1189737	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:22:00.015302+00	2025-08-26 00:22:00.01677+00
1	1258	1189394	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:11:00.016498+00	2025-08-26 00:11:00.017907+00
1	1278	1190056	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:31:00.014591+00	2025-08-26 00:31:00.016427+00
1	1259	1189410	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:12:00.014521+00	2025-08-26 00:12:00.015966+00
1	1270	1189753	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:23:00.017766+00	2025-08-26 00:23:00.019229+00
1	1260	1189610	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:13:00.059788+00	2025-08-26 00:13:00.070036+00
1	1298	1190715	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:51:00.014237+00	2025-08-26 00:51:00.015704+00
1	1279	1190068	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:32:00.014655+00	2025-08-26 00:32:00.016078+00
1	1261	1189623	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:14:00.015555+00	2025-08-26 00:14:00.017014+00
1	1271	1189765	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:24:00.01563+00	2025-08-26 00:24:00.017134+00
1	1262	1189636	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:15:00.015247+00	2025-08-26 00:15:00.016776+00
1	1291	1190425	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:44:00.014926+00	2025-08-26 00:44:00.016368+00
1	1286	1190356	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:39:00.014648+00	2025-08-26 00:39:00.015992+00
1	1272	1189969	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:25:00.019072+00	2025-08-26 00:25:00.025603+00
1	1263	1189654	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:16:00.015775+00	2025-08-26 00:16:00.017181+00
1	1280	1190273	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:33:00.053386+00	2025-08-26 00:33:00.064581+00
1	1264	1189669	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:17:00.015669+00	2025-08-26 00:17:00.01706+00
1	1273	1189988	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:26:00.016889+00	2025-08-26 00:26:00.018414+00
1	1265	1189685	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:18:00.018577+00	2025-08-26 00:18:00.020951+00
1	1295	1190674	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:48:00.016829+00	2025-08-26 00:48:00.018194+00
1	1266	1189697	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:19:00.014375+00	2025-08-26 00:19:00.016081+00
1	1274	1190000	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:27:00.014547+00	2025-08-26 00:27:00.01597+00
1	1281	1190285	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:34:00.014289+00	2025-08-26 00:34:00.015692+00
1	1267	1189709	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:20:00.016642+00	2025-08-26 00:20:00.018058+00
1	1287	1190368	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:40:00.014897+00	2025-08-26 00:40:00.016345+00
1	1275	1190016	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:28:00.017333+00	2025-08-26 00:28:00.018821+00
1	1282	1190297	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:35:00.014955+00	2025-08-26 00:35:00.016456+00
1	1276	1190029	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:29:00.014728+00	2025-08-26 00:29:00.016165+00
1	1292	1190626	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:45:00.101117+00	2025-08-26 00:45:00.128647+00
1	1288	1190383	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:41:00.014868+00	2025-08-26 00:41:00.016342+00
1	1283	1190316	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:36:00.016095+00	2025-08-26 00:36:00.017559+00
1	1307	1191027	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:00:00.014264+00	2025-08-26 01:00:00.015658+00
1	1301	1190945	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:54:00.016254+00	2025-08-26 00:54:00.017644+00
1	1296	1190688	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:49:00.014983+00	2025-08-26 00:49:00.016384+00
1	1284	1190329	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:37:00.015632+00	2025-08-26 00:37:00.01697+00
1	1289	1190397	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:42:00.014867+00	2025-08-26 00:42:00.016277+00
1	1293	1190644	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:46:00.015812+00	2025-08-26 00:46:00.017202+00
1	1299	1190916	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:52:00.050582+00	2025-08-26 00:52:00.071915+00
1	1294	1190657	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:47:00.015276+00	2025-08-26 00:47:00.016727+00
1	1297	1190700	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:50:00.014339+00	2025-08-26 00:50:00.015765+00
1	1303	1190976	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:56:00.015894+00	2025-08-26 00:56:00.017256+00
1	1302	1190958	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:55:00.015643+00	2025-08-26 00:55:00.017092+00
1	1300	1190932	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:53:00.017973+00	2025-08-26 00:53:00.019424+00
1	1308	1191043	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:01:00.015615+00	2025-08-26 01:01:00.017092+00
1	1306	1191015	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:59:00.015123+00	2025-08-26 00:59:00.016658+00
1	1305	1191003	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 00:58:00.018627+00	2025-08-26 00:58:00.020086+00
1	1309	1191055	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:02:00.01503+00	2025-08-26 01:02:00.016442+00
1	1310	1191177	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:03:00.01939+00	2025-08-26 01:03:00.021058+00
1	1311	1191272	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:04:00.015836+00	2025-08-26 01:04:00.018836+00
1	1312	1191285	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:05:00.016327+00	2025-08-26 01:05:00.017799+00
1	1313	1191303	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:06:00.014981+00	2025-08-26 01:06:00.016378+00
1	1314	1191315	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:07:00.014072+00	2025-08-26 01:07:00.015455+00
1	1349	1192557	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:42:00.016868+00	2025-08-26 01:42:00.018302+00
1	1336	1192002	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:29:00.014948+00	2025-08-26 01:29:00.016365+00
1	1315	1191331	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:08:00.020238+00	2025-08-26 01:08:00.021594+00
1	1327	1191687	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:20:00.015284+00	2025-08-26 01:20:00.017675+00
1	1316	1191344	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:09:00.015105+00	2025-08-26 01:09:00.016555+00
1	1363	1192945	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:56:00.014626+00	2025-08-26 01:56:00.016098+00
1	1344	1192301	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:37:00.01559+00	2025-08-26 01:37:00.016949+00
1	1328	1191702	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:21:00.014944+00	2025-08-26 01:21:00.016307+00
1	1317	1191356	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:10:00.014372+00	2025-08-26 01:10:00.016833+00
1	1337	1192014	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:30:00.014478+00	2025-08-26 01:30:00.015861+00
1	1318	1191371	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:11:00.014979+00	2025-08-26 01:11:00.016432+00
1	1329	1191715	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:22:00.014975+00	2025-08-26 01:22:00.016335+00
1	1319	1191383	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:12:00.014757+00	2025-08-26 01:12:00.016121+00
1	1357	1192671	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:50:00.014749+00	2025-08-26 01:50:00.016201+00
1	1338	1192217	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:31:00.073727+00	2025-08-26 01:31:00.07746+00
1	1320	1191398	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:13:00.017043+00	2025-08-26 01:13:00.018456+00
1	1330	1191915	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:23:00.03503+00	2025-08-26 01:23:00.044643+00
1	1321	1191599	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:14:00.077827+00	2025-08-26 01:14:00.129793+00
1	1350	1192570	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:43:00.016641+00	2025-08-26 01:43:00.018009+00
1	1345	1192314	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:38:00.016807+00	2025-08-26 01:38:00.018153+00
1	1331	1191930	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:24:00.014466+00	2025-08-26 01:24:00.015841+00
1	1322	1191612	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:15:00.016115+00	2025-08-26 01:15:00.017663+00
1	1339	1192229	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:32:00.015059+00	2025-08-26 01:32:00.016457+00
1	1323	1191632	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:16:00.015807+00	2025-08-26 01:16:00.017514+00
1	1332	1191942	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:25:00.014742+00	2025-08-26 01:25:00.016164+00
1	1324	1191644	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:17:00.015265+00	2025-08-26 01:17:00.01671+00
1	1354	1192628	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:47:00.014755+00	2025-08-26 01:47:00.016125+00
1	1325	1191660	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:18:00.016965+00	2025-08-26 01:18:00.018485+00
1	1333	1191960	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:26:00.014761+00	2025-08-26 01:26:00.016259+00
1	1340	1192243	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:33:00.018147+00	2025-08-26 01:33:00.01956+00
1	1326	1191675	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:19:00.015649+00	2025-08-26 01:19:00.017067+00
1	1346	1192329	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:39:00.01463+00	2025-08-26 01:39:00.015976+00
1	1334	1191974	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:27:00.01482+00	2025-08-26 01:27:00.016151+00
1	1341	1192258	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:34:00.015522+00	2025-08-26 01:34:00.016935+00
1	1335	1191986	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:28:00.017657+00	2025-08-26 01:28:00.01906+00
1	1351	1192585	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:44:00.014871+00	2025-08-26 01:44:00.016237+00
1	1347	1192342	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:40:00.015298+00	2025-08-26 01:40:00.017398+00
1	1342	1192271	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:35:00.015983+00	2025-08-26 01:35:00.017464+00
1	1366	1192981	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:59:00.015036+00	2025-08-26 01:59:00.016444+00
1	1360	1192899	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:53:00.017912+00	2025-08-26 01:53:00.019308+00
1	1355	1192641	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:48:00.016351+00	2025-08-26 01:48:00.017716+00
1	1343	1192289	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:36:00.015711+00	2025-08-26 01:36:00.017145+00
1	1348	1192545	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:41:00.021728+00	2025-08-26 01:41:00.046854+00
1	1352	1192597	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:45:00.015078+00	2025-08-26 01:45:00.016571+00
1	1358	1192874	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:51:00.025828+00	2025-08-26 01:51:00.032442+00
1	1353	1192615	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:46:00.014709+00	2025-08-26 01:46:00.0161+00
1	1356	1192658	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:49:00.01523+00	2025-08-26 01:49:00.018574+00
1	1362	1192926	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:55:00.014359+00	2025-08-26 01:55:00.015754+00
1	1361	1192911	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:54:00.015259+00	2025-08-26 01:54:00.01669+00
1	1359	1192886	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:52:00.01522+00	2025-08-26 01:52:00.016678+00
1	1367	1192996	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:00:00.014952+00	2025-08-26 02:00:00.016372+00
1	1365	1192969	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:58:00.019263+00	2025-08-26 01:58:00.020649+00
1	1364	1192957	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 01:57:00.015321+00	2025-08-26 01:57:00.016818+00
1	1368	1193199	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:01:00.039919+00	2025-08-26 02:01:00.078301+00
1	1369	1193211	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:02:00.01588+00	2025-08-26 02:02:00.018278+00
1	1370	1193224	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:03:00.017012+00	2025-08-26 02:03:00.018449+00
1	1371	1193237	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:04:00.015934+00	2025-08-26 02:04:00.017388+00
1	1372	1193252	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:05:00.016267+00	2025-08-26 02:05:00.01767+00
1	1373	1193270	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:06:00.015032+00	2025-08-26 02:06:00.016557+00
1	1408	1194697	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:41:00.014568+00	2025-08-26 02:41:00.016088+00
1	1395	1194323	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:28:00.017464+00	2025-08-26 02:28:00.019164+00
1	1374	1193282	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:07:00.018908+00	2025-08-26 02:07:00.020397+00
1	1386	1193639	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:19:00.015474+00	2025-08-26 02:19:00.016911+00
1	1375	1193294	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:08:00.016425+00	2025-08-26 02:08:00.017787+00
1	1422	1195262	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:55:00.014445+00	2025-08-26 02:55:00.015823+00
1	1403	1194630	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:36:00.016443+00	2025-08-26 02:36:00.017992+00
1	1387	1193654	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:20:00.014739+00	2025-08-26 02:20:00.016335+00
1	1376	1193307	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:09:00.014761+00	2025-08-26 02:09:00.016156+00
1	1396	1194337	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:29:00.014221+00	2025-08-26 02:29:00.015597+00
1	1377	1193323	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:10:00.016427+00	2025-08-26 02:10:00.017844+00
1	1388	1193858	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:21:00.044148+00	2025-08-26 02:21:00.093471+00
1	1378	1193339	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:11:00.014857+00	2025-08-26 02:11:00.016425+00
1	1416	1194993	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:49:00.014976+00	2025-08-26 02:49:00.016424+00
1	1397	1194352	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:30:00.015573+00	2025-08-26 02:30:00.017036+00
1	1379	1193540	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:12:00.045348+00	2025-08-26 02:12:00.082669+00
1	1389	1193871	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:22:00.014226+00	2025-08-26 02:22:00.015694+00
1	1380	1193552	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:13:00.017779+00	2025-08-26 02:13:00.019376+00
1	1409	1194896	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:42:00.073354+00	2025-08-26 02:42:00.111451+00
1	1404	1194642	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:37:00.01492+00	2025-08-26 02:37:00.016262+00
1	1390	1194253	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:23:00.01716+00	2025-08-26 02:23:00.019222+00
1	1381	1193564	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:14:00.015236+00	2025-08-26 02:14:00.016618+00
1	1398	1194367	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:31:00.014638+00	2025-08-26 02:31:00.015993+00
1	1382	1193580	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:15:00.015529+00	2025-08-26 02:15:00.01699+00
1	1391	1194265	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:24:00.016195+00	2025-08-26 02:24:00.017558+00
1	1383	1193599	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:16:00.015958+00	2025-08-26 02:16:00.017364+00
1	1413	1194954	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:46:00.01617+00	2025-08-26 02:46:00.017573+00
1	1384	1193611	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:17:00.014804+00	2025-08-26 02:17:00.016167+00
1	1392	1194280	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:25:00.016051+00	2025-08-26 02:25:00.017684+00
1	1399	1194379	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:32:00.014955+00	2025-08-26 02:32:00.016368+00
1	1385	1193627	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:18:00.016076+00	2025-08-26 02:18:00.0178+00
1	1405	1194654	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:38:00.016916+00	2025-08-26 02:38:00.01829+00
1	1393	1194298	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:26:00.014848+00	2025-08-26 02:26:00.016166+00
1	1400	1194391	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:33:00.017477+00	2025-08-26 02:33:00.019211+00
1	1394	1194310	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:27:00.014926+00	2025-08-26 02:27:00.01633+00
1	1410	1194909	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:43:00.0185+00	2025-08-26 02:43:00.020891+00
1	1406	1194666	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:39:00.013941+00	2025-08-26 02:39:00.015351+00
1	1401	1194454	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:34:00.017434+00	2025-08-26 02:34:00.019157+00
1	1425	1195308	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:58:00.018437+00	2025-08-26 02:58:00.020002+00
1	1419	1195036	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:52:00.016434+00	2025-08-26 02:52:00.017849+00
1	1414	1194967	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:47:00.015158+00	2025-08-26 02:47:00.016632+00
1	1402	1194608	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:35:00.016335+00	2025-08-26 02:35:00.018558+00
1	1407	1194678	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:40:00.01519+00	2025-08-26 02:40:00.01656+00
1	1411	1194921	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:44:00.015509+00	2025-08-26 02:44:00.016943+00
1	1417	1195006	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:50:00.014735+00	2025-08-26 02:50:00.016215+00
1	1412	1194933	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:45:00.016371+00	2025-08-26 02:45:00.01786+00
1	1415	1194980	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:48:00.017004+00	2025-08-26 02:48:00.018456+00
1	1421	1195250	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:54:00.019382+00	2025-08-26 02:54:00.031976+00
1	1420	1195048	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:53:00.016819+00	2025-08-26 02:53:00.018314+00
1	1418	1195024	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:51:00.014888+00	2025-08-26 02:51:00.01629+00
1	1426	1195320	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:59:00.015356+00	2025-08-26 02:59:00.016817+00
1	1424	1195296	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:57:00.0163+00	2025-08-26 02:57:00.017704+00
1	1423	1195284	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 02:56:00.014642+00	2025-08-26 02:56:00.016016+00
1	1427	1195333	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:00:00.014697+00	2025-08-26 03:00:00.016037+00
1	1428	1195352	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:01:00.014735+00	2025-08-26 03:01:00.016132+00
1	1429	1195364	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:02:00.015445+00	2025-08-26 03:02:00.016856+00
1	1430	1195563	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:03:00.088581+00	2025-08-26 03:03:00.101864+00
1	1431	1195576	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:04:00.015104+00	2025-08-26 03:04:00.016529+00
1	1432	1195588	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:05:00.016763+00	2025-08-26 03:05:00.018195+00
1	1467	1196645	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:40:00.015105+00	2025-08-26 03:40:00.016501+00
1	1454	1196280	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:27:00.01804+00	2025-08-26 03:27:00.019654+00
1	1433	1195609	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:06:00.020742+00	2025-08-26 03:06:00.022198+00
1	1445	1195967	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:18:00.017906+00	2025-08-26 03:18:00.019295+00
1	1434	1195622	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:07:00.01495+00	2025-08-26 03:07:00.016308+00
1	1481	1197217	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:54:00.017077+00	2025-08-26 03:54:00.018545+00
1	1462	1196573	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:35:00.016461+00	2025-08-26 03:35:00.017986+00
1	1446	1195979	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:19:00.014675+00	2025-08-26 03:19:00.016064+00
1	1435	1195635	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:08:00.016524+00	2025-08-26 03:08:00.017974+00
1	1455	1196292	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:28:00.015525+00	2025-08-26 03:28:00.017039+00
1	1436	1195648	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:09:00.015803+00	2025-08-26 03:09:00.017255+00
1	1447	1195992	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:20:00.015471+00	2025-08-26 03:20:00.016848+00
1	1437	1195660	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:10:00.014193+00	2025-08-26 03:10:00.015583+00
1	1475	1196947	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:48:00.017465+00	2025-08-26 03:48:00.01889+00
1	1456	1196304	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:29:00.016065+00	2025-08-26 03:29:00.017485+00
1	1438	1195681	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:11:00.016466+00	2025-08-26 03:11:00.018078+00
1	1448	1196197	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:21:00.035832+00	2025-08-26 03:21:00.050607+00
1	1439	1195693	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:12:00.015619+00	2025-08-26 03:12:00.017125+00
1	1468	1196660	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:41:00.015231+00	2025-08-26 03:41:00.016598+00
1	1463	1196591	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:36:00.016155+00	2025-08-26 03:36:00.017557+00
1	1449	1196209	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:22:00.015136+00	2025-08-26 03:22:00.017376+00
1	1440	1195705	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:13:00.017215+00	2025-08-26 03:13:00.018593+00
1	1457	1196316	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:30:00.014072+00	2025-08-26 03:30:00.015456+00
1	1441	1195717	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:14:00.015039+00	2025-08-26 03:14:00.016489+00
1	1450	1196222	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:23:00.01852+00	2025-08-26 03:23:00.020197+00
1	1442	1195918	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:15:00.036055+00	2025-08-26 03:15:00.069923+00
1	1472	1196898	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:45:00.016025+00	2025-08-26 03:45:00.017464+00
1	1443	1195939	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:16:00.014614+00	2025-08-26 03:16:00.016043+00
1	1451	1196234	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:24:00.015782+00	2025-08-26 03:24:00.018141+00
1	1458	1196331	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:31:00.01568+00	2025-08-26 03:31:00.017104+00
1	1444	1195951	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:17:00.015512+00	2025-08-26 03:17:00.016892+00
1	1464	1196607	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:37:00.015715+00	2025-08-26 03:37:00.01715+00
1	1452	1196246	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:25:00.015553+00	2025-08-26 03:25:00.016993+00
1	1459	1196347	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:32:00.014681+00	2025-08-26 03:32:00.016062+00
1	1453	1196268	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:26:00.015578+00	2025-08-26 03:26:00.017055+00
1	1469	1196862	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:42:00.06444+00	2025-08-26 03:42:00.151177+00
1	1465	1196619	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:38:00.01727+00	2025-08-26 03:38:00.018785+00
1	1460	1196549	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:33:00.029426+00	2025-08-26 03:33:00.042581+00
1	1484	1197259	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:57:00.01571+00	2025-08-26 03:57:00.017195+00
1	1478	1196988	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:51:00.014333+00	2025-08-26 03:51:00.015775+00
1	1473	1196918	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:46:00.015597+00	2025-08-26 03:46:00.016972+00
1	1461	1196561	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:34:00.016867+00	2025-08-26 03:34:00.018291+00
1	1466	1196632	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:39:00.014666+00	2025-08-26 03:39:00.016031+00
1	1470	1196874	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:43:00.01814+00	2025-08-26 03:43:00.019608+00
1	1476	1196960	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:49:00.015886+00	2025-08-26 03:49:00.017272+00
1	1471	1196886	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:44:00.016595+00	2025-08-26 03:44:00.018036+00
1	1474	1196933	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:47:00.015175+00	2025-08-26 03:47:00.016524+00
1	1480	1197204	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:53:00.01701+00	2025-08-26 03:53:00.018458+00
1	1479	1197188	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:52:00.062228+00	2025-08-26 03:52:00.070862+00
1	1477	1196972	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:50:00.014549+00	2025-08-26 03:50:00.015915+00
1	1485	1197274	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:58:00.018894+00	2025-08-26 03:58:00.020256+00
1	1483	1197247	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:56:00.01459+00	2025-08-26 03:56:00.015942+00
1	1482	1197229	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:55:00.015171+00	2025-08-26 03:55:00.016838+00
1	1486	1197286	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 03:59:00.01481+00	2025-08-26 03:59:00.016239+00
1	1487	1197299	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:00:00.014294+00	2025-08-26 04:00:00.01572+00
1	1488	1197315	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:01:00.014476+00	2025-08-26 04:01:00.015894+00
1	1489	1197327	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:02:00.015194+00	2025-08-26 04:02:00.016655+00
1	1490	1197532	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:03:00.025896+00	2025-08-26 04:03:00.038959+00
1	1491	1197544	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:04:00.015627+00	2025-08-26 04:04:00.017012+00
1	1526	1198598	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:39:00.014718+00	2025-08-26 04:39:00.01608+00
1	1513	1198232	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:26:00.014763+00	2025-08-26 04:26:00.016318+00
1	1492	1197556	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:05:00.016447+00	2025-08-26 04:05:00.017905+00
1	1504	1197916	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:17:00.01634+00	2025-08-26 04:17:00.017702+00
1	1493	1197576	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:06:00.016384+00	2025-08-26 04:06:00.017827+00
1	1540	1199208	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:53:00.077049+00	2025-08-26 04:53:00.081137+00
1	1521	1198526	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:34:00.016009+00	2025-08-26 04:34:00.017488+00
1	1505	1197936	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:18:00.022573+00	2025-08-26 04:18:00.023951+00
1	1494	1197588	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:07:00.014466+00	2025-08-26 04:07:00.015895+00
1	1514	1198244	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:27:00.015181+00	2025-08-26 04:27:00.016672+00
1	1495	1197603	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:08:00.018516+00	2025-08-26 04:08:00.019973+00
1	1506	1197948	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:19:00.014794+00	2025-08-26 04:19:00.016215+00
1	1496	1197616	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:09:00.015975+00	2025-08-26 04:09:00.017322+00
1	1534	1198929	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:47:00.015291+00	2025-08-26 04:47:00.016976+00
1	1515	1198256	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:28:00.018142+00	2025-08-26 04:28:00.019823+00
1	1497	1197628	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:10:00.01512+00	2025-08-26 04:10:00.016491+00
1	1507	1197960	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:20:00.015363+00	2025-08-26 04:20:00.016772+00
1	1498	1197644	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:11:00.015449+00	2025-08-26 04:11:00.017026+00
1	1527	1198610	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:40:00.01607+00	2025-08-26 04:40:00.017677+00
1	1522	1198539	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:35:00.015207+00	2025-08-26 04:35:00.016577+00
1	1508	1198162	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:21:00.064709+00	2025-08-26 04:21:00.077568+00
1	1499	1197657	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:12:00.015404+00	2025-08-26 04:12:00.016774+00
1	1516	1198271	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:29:00.015132+00	2025-08-26 04:29:00.016539+00
1	1500	1197672	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:13:00.018209+00	2025-08-26 04:13:00.019707+00
1	1509	1198174	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:22:00.016892+00	2025-08-26 04:22:00.019107+00
1	1501	1197684	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:14:00.015577+00	2025-08-26 04:14:00.01702+00
1	1531	1198872	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:44:00.016994+00	2025-08-26 04:44:00.018625+00
1	1502	1197885	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:15:00.064244+00	2025-08-26 04:15:00.121811+00
1	1510	1198189	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:23:00.017082+00	2025-08-26 04:23:00.018497+00
1	1517	1198284	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:30:00.015496+00	2025-08-26 04:30:00.016879+00
1	1503	1197903	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:16:00.01465+00	2025-08-26 04:16:00.016036+00
1	1523	1198558	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:36:00.0152+00	2025-08-26 04:36:00.016742+00
1	1511	1198201	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:24:00.014792+00	2025-08-26 04:24:00.016198+00
1	1518	1198300	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:31:00.015046+00	2025-08-26 04:31:00.01647+00
1	1512	1198214	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:25:00.015218+00	2025-08-26 04:25:00.016877+00
1	1528	1198625	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:41:00.015271+00	2025-08-26 04:41:00.016682+00
1	1524	1198570	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:37:00.015277+00	2025-08-26 04:37:00.016624+00
1	1519	1198312	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:32:00.015094+00	2025-08-26 04:32:00.016515+00
1	1543	1199264	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:56:00.014638+00	2025-08-26 04:56:00.016779+00
1	1537	1198978	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:50:00.015269+00	2025-08-26 04:50:00.016815+00
1	1532	1198886	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:45:00.016851+00	2025-08-26 04:45:00.018543+00
1	1520	1198511	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:33:00.051468+00	2025-08-26 04:33:00.082196+00
1	1525	1198583	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:38:00.018153+00	2025-08-26 04:38:00.019638+00
1	1529	1198639	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:42:00.01568+00	2025-08-26 04:42:00.017146+00
1	1535	1198942	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:48:00.017815+00	2025-08-26 04:48:00.019517+00
1	1530	1198842	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:43:00.065168+00	2025-08-26 04:43:00.090137+00
1	1533	1198907	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:46:00.015043+00	2025-08-26 04:46:00.016709+00
1	1539	1199008	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:52:00.015086+00	2025-08-26 04:52:00.016534+00
1	1538	1198993	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:51:00.01451+00	2025-08-26 04:51:00.015953+00
1	1536	1198964	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:49:00.015108+00	2025-08-26 04:49:00.016625+00
1	1544	1199276	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:57:00.015656+00	2025-08-26 04:57:00.017107+00
1	1542	1199246	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:55:00.015895+00	2025-08-26 04:55:00.017446+00
1	1541	1199227	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:54:00.017104+00	2025-08-26 04:54:00.019563+00
1	1545	1199289	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:58:00.017248+00	2025-08-26 04:58:00.018695+00
1	1546	1199305	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 04:59:00.014777+00	2025-08-26 04:59:00.016188+00
1	1547	1199317	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:00:00.014623+00	2025-08-26 05:00:00.016036+00
1	1548	1199332	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:01:00.01712+00	2025-08-26 05:01:00.019603+00
1	1549	1199345	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:02:00.015166+00	2025-08-26 05:02:00.016646+00
1	1550	1199357	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:03:00.017041+00	2025-08-26 05:03:00.018526+00
1	1585	1200645	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:38:00.016894+00	2025-08-26 05:38:00.018472+00
1	1572	1200267	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:25:00.015297+00	2025-08-26 05:25:00.016688+00
1	1551	1199373	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:04:00.018112+00	2025-08-26 05:04:00.019588+00
1	1563	1199922	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:16:00.016266+00	2025-08-26 05:16:00.017766+00
1	1552	1199576	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:05:00.02926+00	2025-08-26 05:05:00.036801+00
1	1599	1201239	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:52:00.180106+00	2025-08-26 05:52:00.189078+00
1	1580	1200385	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:33:00.017894+00	2025-08-26 05:33:00.02037+00
1	1564	1199957	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:17:00.023539+00	2025-08-26 05:17:00.025675+00
1	1553	1199594	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:06:00.017363+00	2025-08-26 05:06:00.018933+00
1	1573	1200286	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:26:00.0145+00	2025-08-26 05:26:00.015968+00
1	1554	1199606	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:07:00.015033+00	2025-08-26 05:07:00.016461+00
1	1565	1199981	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:18:00.017812+00	2025-08-26 05:18:00.019571+00
1	1555	1199618	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:08:00.016312+00	2025-08-26 05:08:00.017763+00
1	1593	1200949	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:46:00.014656+00	2025-08-26 05:46:00.016089+00
1	1574	1200298	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:27:00.014244+00	2025-08-26 05:27:00.015634+00
1	1556	1199630	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:09:00.016403+00	2025-08-26 05:09:00.0179+00
1	1566	1199994	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:19:00.014692+00	2025-08-26 05:19:00.016184+00
1	1557	1199646	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:10:00.014292+00	2025-08-26 05:10:00.01585+00
1	1586	1200657	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:39:00.014689+00	2025-08-26 05:39:00.016106+00
1	1581	1200585	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:34:00.068812+00	2025-08-26 05:34:00.075878+00
1	1567	1200009	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:20:00.015156+00	2025-08-26 05:20:00.016805+00
1	1558	1199661	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:11:00.015294+00	2025-08-26 05:11:00.016778+00
1	1575	1200317	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:28:00.016311+00	2025-08-26 05:28:00.01872+00
1	1559	1199864	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:12:00.030629+00	2025-08-26 05:12:00.037615+00
1	1568	1200212	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:21:00.058242+00	2025-08-26 05:21:00.062597+00
1	1560	1199876	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:13:00.017332+00	2025-08-26 05:13:00.018815+00
1	1590	1200903	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:43:00.017147+00	2025-08-26 05:43:00.0187+00
1	1561	1199888	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:14:00.014689+00	2025-08-26 05:14:00.016452+00
1	1569	1200224	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:22:00.015085+00	2025-08-26 05:22:00.016638+00
1	1576	1200329	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:29:00.014687+00	2025-08-26 05:29:00.016067+00
1	1562	1199903	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:15:00.014812+00	2025-08-26 05:15:00.016197+00
1	1582	1200601	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:35:00.014865+00	2025-08-26 05:35:00.016331+00
1	1570	1200239	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:23:00.016961+00	2025-08-26 05:23:00.018456+00
1	1577	1200345	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:30:00.014761+00	2025-08-26 05:30:00.016228+00
1	1571	1200251	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:24:00.016674+00	2025-08-26 05:24:00.018198+00
1	1587	1200672	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:40:00.014779+00	2025-08-26 05:40:00.016207+00
1	1583	1200620	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:36:00.014515+00	2025-08-26 05:36:00.015951+00
1	1578	1200360	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:31:00.014678+00	2025-08-26 05:31:00.017168+00
1	1602	1201276	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:55:00.015359+00	2025-08-26 05:55:00.01683+00
1	1596	1200989	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:49:00.016223+00	2025-08-26 05:49:00.017891+00
1	1591	1200916	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:44:00.015706+00	2025-08-26 05:44:00.017258+00
1	1579	1200373	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:32:00.01572+00	2025-08-26 05:32:00.017307+00
1	1584	1200632	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:37:00.014219+00	2025-08-26 05:37:00.015636+00
1	1588	1200687	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:41:00.014957+00	2025-08-26 05:41:00.016355+00
1	1594	1200961	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:47:00.014811+00	2025-08-26 05:47:00.016281+00
1	1589	1200891	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:42:00.084864+00	2025-08-26 05:42:00.093697+00
1	1592	1200928	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:45:00.015186+00	2025-08-26 05:45:00.016791+00
1	1598	1201035	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:51:00.014668+00	2025-08-26 05:51:00.016116+00
1	1597	1201002	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:50:00.014667+00	2025-08-26 05:50:00.01609+00
1	1595	1200975	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:48:00.017251+00	2025-08-26 05:48:00.018716+00
1	1603	1201298	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:56:00.015503+00	2025-08-26 05:56:00.017033+00
1	1601	1201264	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:54:00.015836+00	2025-08-26 05:54:00.017282+00
1	1600	1201251	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:53:00.017618+00	2025-08-26 05:53:00.019173+00
1	1604	1201310	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:57:00.015023+00	2025-08-26 05:57:00.016481+00
1	1605	1201322	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:58:00.017174+00	2025-08-26 05:58:00.018711+00
1	1606	1201335	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 05:59:00.018225+00	2025-08-26 05:59:00.019679+00
1	1607	1201348	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:00:00.014982+00	2025-08-26 06:00:00.016804+00
1	1608	1201366	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:01:00.014564+00	2025-08-26 06:01:00.016817+00
1	1609	1201379	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:02:00.015095+00	2025-08-26 06:02:00.016564+00
1	1644	1202770	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:37:00.016134+00	2025-08-26 06:37:00.017627+00
1	1631	1202141	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:24:00.015332+00	2025-08-26 06:24:00.016862+00
1	1610	1201391	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:03:00.019592+00	2025-08-26 06:03:00.021108+00
1	1622	1201939	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:15:00.015399+00	2025-08-26 06:15:00.016949+00
1	1611	1201592	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:04:00.0931+00	2025-08-26 06:04:00.104449+00
1	1658	1203152	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:51:00.015843+00	2025-08-26 06:51:00.017391+00
1	1639	1202511	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:32:00.016175+00	2025-08-26 06:32:00.017858+00
1	1623	1201957	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:16:00.016093+00	2025-08-26 06:16:00.017542+00
1	1612	1201604	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:05:00.014549+00	2025-08-26 06:05:00.016102+00
1	1632	1202201	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:25:00.046824+00	2025-08-26 06:25:00.049112+00
1	1613	1201623	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:06:00.015231+00	2025-08-26 06:06:00.016669+00
1	1624	1201973	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:17:00.015196+00	2025-08-26 06:17:00.016676+00
1	1614	1201638	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:07:00.015262+00	2025-08-26 06:07:00.016799+00
1	1652	1203064	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:45:00.08399+00	2025-08-26 06:45:00.097197+00
1	1633	1202428	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:26:00.016276+00	2025-08-26 06:26:00.021515+00
1	1615	1201652	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:08:00.017035+00	2025-08-26 06:08:00.01863+00
1	1625	1201990	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:18:00.017318+00	2025-08-26 06:18:00.018856+00
1	1616	1201664	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:09:00.014865+00	2025-08-26 06:09:00.016308+00
1	1645	1202782	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:38:00.016368+00	2025-08-26 06:38:00.017811+00
1	1640	1202523	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:33:00.016968+00	2025-08-26 06:33:00.018477+00
1	1626	1202002	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:19:00.014532+00	2025-08-26 06:19:00.015968+00
1	1617	1201676	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:10:00.014605+00	2025-08-26 06:10:00.016029+00
1	1634	1202443	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:27:00.015224+00	2025-08-26 06:27:00.016637+00
1	1618	1201882	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:11:00.049828+00	2025-08-26 06:11:00.057577+00
1	1627	1202014	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:20:00.015418+00	2025-08-26 06:20:00.016924+00
1	1619	1201898	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:12:00.016261+00	2025-08-26 06:12:00.017852+00
1	1649	1202838	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:42:00.014804+00	2025-08-26 06:42:00.016206+00
1	1620	1201911	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:13:00.016309+00	2025-08-26 06:13:00.017748+00
1	1628	1202031	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:21:00.014379+00	2025-08-26 06:21:00.015823+00
1	1635	1202456	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:28:00.016688+00	2025-08-26 06:28:00.018124+00
1	1621	1201926	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:14:00.03068+00	2025-08-26 06:14:00.032175+00
1	1641	1202724	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:34:00.086081+00	2025-08-26 06:34:00.090557+00
1	1629	1202046	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:22:00.016072+00	2025-08-26 06:22:00.017761+00
1	1636	1202469	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:29:00.015078+00	2025-08-26 06:29:00.016506+00
1	1630	1202129	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:23:00.030214+00	2025-08-26 06:23:00.032786+00
1	1646	1202795	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:39:00.014898+00	2025-08-26 06:39:00.016346+00
1	1642	1202736	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:35:00.015326+00	2025-08-26 06:35:00.01686+00
1	1637	1202481	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:30:00.015257+00	2025-08-26 06:30:00.016741+00
1	1661	1203383	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:54:00.014563+00	2025-08-26 06:54:00.015969+00
1	1655	1203112	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:48:00.018007+00	2025-08-26 06:48:00.019471+00
1	1650	1202850	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:43:00.018092+00	2025-08-26 06:43:00.019624+00
1	1638	1202496	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:31:00.016904+00	2025-08-26 06:31:00.018543+00
1	1643	1202755	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:36:00.015099+00	2025-08-26 06:36:00.016532+00
1	1647	1202808	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:40:00.014783+00	2025-08-26 06:40:00.016209+00
1	1653	1203083	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:46:00.015024+00	2025-08-26 06:46:00.016484+00
1	1648	1202823	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:41:00.015224+00	2025-08-26 06:41:00.016777+00
1	1651	1202862	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:44:00.015091+00	2025-08-26 06:44:00.016567+00
1	1657	1203137	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:50:00.014458+00	2025-08-26 06:50:00.015799+00
1	1656	1203125	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:49:00.01524+00	2025-08-26 06:49:00.016732+00
1	1654	1203096	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:47:00.014906+00	2025-08-26 06:47:00.016335+00
1	1662	1203395	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:55:00.014991+00	2025-08-26 06:55:00.01758+00
1	1660	1203371	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:53:00.058962+00	2025-08-26 06:53:00.065397+00
1	1659	1203165	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:52:00.016874+00	2025-08-26 06:52:00.018622+00
1	1663	1203413	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:56:00.014881+00	2025-08-26 06:56:00.016333+00
1	1664	1203425	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:57:00.015259+00	2025-08-26 06:57:00.016703+00
1	1665	1203440	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:58:00.019797+00	2025-08-26 06:58:00.021414+00
1	1666	1203469	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 06:59:00.031612+00	2025-08-26 06:59:00.036718+00
1	1667	1203482	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:00:00.015484+00	2025-08-26 07:00:00.018267+00
1	1668	1203506	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:01:00.014929+00	2025-08-26 07:01:00.016493+00
1	1703	1204835	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:36:00.014599+00	2025-08-26 07:36:00.016078+00
1	1690	1204412	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:23:00.017933+00	2025-08-26 07:23:00.019429+00
1	1669	1203530	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:02:00.036377+00	2025-08-26 07:02:00.038111+00
1	1681	1204091	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:14:00.016385+00	2025-08-26 07:14:00.017838+00
1	1670	1203725	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:03:00.050691+00	2025-08-26 07:03:00.055118+00
1	1717	1205215	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:50:00.01588+00	2025-08-26 07:50:00.017396+00
1	1698	1204574	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:31:00.015161+00	2025-08-26 07:31:00.016653+00
1	1682	1204103	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:15:00.014518+00	2025-08-26 07:15:00.015912+00
1	1671	1203737	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:04:00.015714+00	2025-08-26 07:04:00.017264+00
1	1691	1204441	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:24:00.015927+00	2025-08-26 07:24:00.017472+00
1	1672	1203751	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:05:00.014726+00	2025-08-26 07:05:00.016142+00
1	1683	1204122	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:16:00.015274+00	2025-08-26 07:16:00.016655+00
1	1673	1203780	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:06:00.014145+00	2025-08-26 07:06:00.015582+00
1	1711	1204942	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:44:00.015127+00	2025-08-26 07:44:00.016581+00
1	1692	1204476	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:25:00.016003+00	2025-08-26 07:25:00.017597+00
1	1674	1203792	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:07:00.015114+00	2025-08-26 07:07:00.016625+00
1	1684	1204135	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:17:00.014602+00	2025-08-26 07:17:00.016009+00
1	1675	1203808	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:08:00.017336+00	2025-08-26 07:08:00.018897+00
1	1704	1204847	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:37:00.017561+00	2025-08-26 07:37:00.019075+00
1	1699	1204586	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:32:00.014011+00	2025-08-26 07:32:00.015532+00
1	1685	1204155	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:18:00.016401+00	2025-08-26 07:18:00.017847+00
1	1676	1203827	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:09:00.037222+00	2025-08-26 07:09:00.038665+00
1	1693	1204494	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:26:00.014499+00	2025-08-26 07:26:00.015928+00
1	1677	1203846	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:10:00.015509+00	2025-08-26 07:10:00.017598+00
1	1686	1204167	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:19:00.014735+00	2025-08-26 07:19:00.016306+00
1	1678	1203903	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:11:00.045069+00	2025-08-26 07:11:00.048531+00
1	1708	1204902	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:41:00.015673+00	2025-08-26 07:41:00.017183+00
1	1679	1204063	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:12:00.051658+00	2025-08-26 07:12:00.057835+00
1	1687	1204179	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:20:00.014915+00	2025-08-26 07:20:00.016315+00
1	1694	1204517	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:27:00.015178+00	2025-08-26 07:27:00.017229+00
1	1680	1204079	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:13:00.018473+00	2025-08-26 07:13:00.019977+00
1	1700	1204710	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:33:00.118622+00	2025-08-26 07:33:00.130556+00
1	1688	1204382	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:21:00.164112+00	2025-08-26 07:21:00.170695+00
1	1695	1204531	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:28:00.01584+00	2025-08-26 07:28:00.017356+00
1	1689	1204395	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:22:00.014716+00	2025-08-26 07:22:00.016238+00
1	1705	1204859	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:38:00.01816+00	2025-08-26 07:38:00.020163+00
1	1701	1204804	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:34:00.019335+00	2025-08-26 07:34:00.02183+00
1	1696	1204546	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:29:00.01454+00	2025-08-26 07:29:00.016059+00
1	1720	1205255	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:53:00.017735+00	2025-08-26 07:53:00.020148+00
1	1714	1205172	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:47:00.015888+00	2025-08-26 07:47:00.017495+00
1	1709	1204915	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:42:00.014565+00	2025-08-26 07:42:00.016041+00
1	1697	1204558	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:30:00.014643+00	2025-08-26 07:30:00.016127+00
1	1702	1204816	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:35:00.014979+00	2025-08-26 07:35:00.017161+00
1	1706	1204874	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:39:00.017667+00	2025-08-26 07:39:00.019265+00
1	1712	1205141	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:45:00.033394+00	2025-08-26 07:45:00.040015+00
1	1707	1204887	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:40:00.015204+00	2025-08-26 07:40:00.016691+00
1	1710	1204927	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:43:00.017701+00	2025-08-26 07:43:00.019177+00
1	1716	1205203	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:49:00.015269+00	2025-08-26 07:49:00.016709+00
1	1715	1205186	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:48:00.018483+00	2025-08-26 07:48:00.019896+00
1	1713	1205160	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:46:00.015116+00	2025-08-26 07:46:00.016527+00
1	1721	1205270	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:54:00.014589+00	2025-08-26 07:54:00.016012+00
1	1719	1205243	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:52:00.015518+00	2025-08-26 07:52:00.017019+00
1	1718	1205230	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:51:00.01633+00	2025-08-26 07:51:00.017779+00
1	1722	1205472	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:55:00.026194+00	2025-08-26 07:55:00.033452+00
1	1723	1205490	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:56:00.015288+00	2025-08-26 07:56:00.016809+00
1	1724	1205502	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:57:00.015103+00	2025-08-26 07:57:00.016497+00
1	1725	1205514	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:58:00.017691+00	2025-08-26 07:58:00.019131+00
1	1726	1205529	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 07:59:00.01414+00	2025-08-26 07:59:00.016521+00
1	1727	1205541	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:00:00.014624+00	2025-08-26 08:00:00.016504+00
1	1762	1206883	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:35:00.041087+00	2025-08-26 08:35:00.045656+00
1	1749	1206277	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:22:00.015195+00	2025-08-26 08:22:00.016707+00
1	1728	1205557	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:01:00.022122+00	2025-08-26 08:01:00.023601+00
1	1740	1206127	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:13:00.017971+00	2025-08-26 08:13:00.019468+00
1	1729	1205678	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:02:00.070227+00	2025-08-26 08:02:00.073813+00
1	1776	1207277	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:49:00.015447+00	2025-08-26 08:49:00.016906+00
1	1757	1206584	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:30:00.014807+00	2025-08-26 08:30:00.016209+00
1	1741	1206150	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:14:00.01515+00	2025-08-26 08:14:00.016656+00
1	1730	1205769	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:03:00.019844+00	2025-08-26 08:03:00.021909+00
1	1750	1206484	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:23:00.174312+00	2025-08-26 08:23:00.188286+00
1	1731	1205784	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:04:00.01542+00	2025-08-26 08:04:00.017877+00
1	1742	1206162	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:15:00.014784+00	2025-08-26 08:15:00.01624+00
1	1732	1205797	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:05:00.015897+00	2025-08-26 08:05:00.01735+00
1	1770	1207190	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:43:00.016852+00	2025-08-26 08:43:00.018324+00
1	1751	1206496	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:24:00.015937+00	2025-08-26 08:24:00.017378+00
1	1733	1205816	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:06:00.014175+00	2025-08-26 08:06:00.015593+00
1	1743	1206180	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:16:00.015139+00	2025-08-26 08:16:00.016701+00
1	1734	1205829	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:07:00.014607+00	2025-08-26 08:07:00.016012+00
1	1763	1206905	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:36:00.01496+00	2025-08-26 08:36:00.016407+00
1	1758	1206600	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:31:00.015027+00	2025-08-26 08:31:00.016548+00
1	1744	1206193	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:17:00.014771+00	2025-08-26 08:17:00.016169+00
1	1735	1205853	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:08:00.029669+00	2025-08-26 08:08:00.032461+00
1	1752	1206514	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:25:00.014703+00	2025-08-26 08:25:00.016172+00
1	1736	1205870	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:09:00.014887+00	2025-08-26 08:09:00.016319+00
1	1745	1206218	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:18:00.016271+00	2025-08-26 08:18:00.017711+00
1	1737	1205889	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:10:00.014693+00	2025-08-26 08:10:00.019268+00
1	1767	1206961	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:40:00.014826+00	2025-08-26 08:40:00.016372+00
1	1738	1205982	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:11:00.053946+00	2025-08-26 08:11:00.056585+00
1	1746	1206232	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:19:00.014367+00	2025-08-26 08:19:00.015793+00
1	1753	1206533	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:26:00.014341+00	2025-08-26 08:26:00.015799+00
1	1739	1206115	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:12:00.031846+00	2025-08-26 08:12:00.034679+00
1	1759	1206612	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:32:00.015008+00	2025-08-26 08:32:00.016754+00
1	1747	1206249	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:20:00.014892+00	2025-08-26 08:20:00.016301+00
1	1754	1206545	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:27:00.014516+00	2025-08-26 08:27:00.015871+00
1	1748	1206264	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:21:00.014597+00	2025-08-26 08:21:00.016033+00
1	1764	1206917	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:37:00.014211+00	2025-08-26 08:37:00.015647+00
1	1760	1206644	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:33:00.01857+00	2025-08-26 08:33:00.020032+00
1	1755	1206557	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:28:00.018302+00	2025-08-26 08:28:00.019819+00
1	1779	1207321	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:52:00.014339+00	2025-08-26 08:52:00.015856+00
1	1773	1207238	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:46:00.015054+00	2025-08-26 08:46:00.016565+00
1	1768	1206976	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:41:00.014728+00	2025-08-26 08:41:00.016187+00
1	1756	1206569	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:29:00.015419+00	2025-08-26 08:29:00.016839+00
1	1761	1206674	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:34:00.027414+00	2025-08-26 08:34:00.028896+00
1	1765	1206931	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:38:00.016432+00	2025-08-26 08:38:00.01946+00
1	1771	1207203	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:44:00.015016+00	2025-08-26 08:44:00.016694+00
1	1766	1206945	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:39:00.016913+00	2025-08-26 08:39:00.018875+00
1	1769	1207114	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:42:00.11172+00	2025-08-26 08:42:00.123641+00
1	1775	1207263	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:48:00.017891+00	2025-08-26 08:48:00.019347+00
1	1774	1207250	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:47:00.014321+00	2025-08-26 08:47:00.015765+00
1	1772	1207219	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:45:00.01572+00	2025-08-26 08:45:00.017205+00
1	1780	1207472	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:53:00.132557+00	2025-08-26 08:53:00.234664+00
1	1778	1207308	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:51:00.015072+00	2025-08-26 08:51:00.016585+00
1	1777	1207293	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:50:00.014888+00	2025-08-26 08:50:00.016385+00
1	1781	1207532	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:54:00.01531+00	2025-08-26 08:54:00.016722+00
1	1782	1207545	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:55:00.014552+00	2025-08-26 08:55:00.016003+00
1	1783	1207566	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:56:00.016836+00	2025-08-26 08:56:00.018304+00
1	1784	1207578	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:57:00.015549+00	2025-08-26 08:57:00.016932+00
1	1785	1207591	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:58:00.017744+00	2025-08-26 08:58:00.019283+00
1	1786	1207603	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 08:59:00.014999+00	2025-08-26 08:59:00.016563+00
1	1821	1209229	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:34:00.015012+00	2025-08-26 09:34:00.016611+00
1	1808	1208518	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:21:00.016069+00	2025-08-26 09:21:00.017672+00
1	1787	1207616	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:00:00.017009+00	2025-08-26 09:00:00.018431+00
1	1799	1208084	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:12:00.015167+00	2025-08-26 09:12:00.016624+00
1	1788	1207635	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:01:00.015077+00	2025-08-26 09:01:00.016508+00
1	1835	1209727	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:48:00.018319+00	2025-08-26 09:48:00.019959+00
1	1816	1208878	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:29:00.014797+00	2025-08-26 09:29:00.016341+00
1	1800	1208112	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:13:00.016494+00	2025-08-26 09:13:00.017985+00
1	1789	1207657	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:02:00.015339+00	2025-08-26 09:02:00.016832+00
1	1809	1208548	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:22:00.014503+00	2025-08-26 09:22:00.016125+00
1	1790	1207871	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:03:00.086166+00	2025-08-26 09:03:00.08769+00
1	1801	1208140	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:14:00.015077+00	2025-08-26 09:14:00.016543+00
1	1791	1207884	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:04:00.016541+00	2025-08-26 09:04:00.01804+00
1	1829	1209403	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:42:00.015375+00	2025-08-26 09:42:00.017023+00
1	1810	1208755	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:23:00.184201+00	2025-08-26 09:23:00.193475+00
1	1792	1207914	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:05:00.014955+00	2025-08-26 09:05:00.016515+00
1	1802	1208342	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:15:00.087243+00	2025-08-26 09:15:00.095005+00
1	1793	1207956	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:06:00.015492+00	2025-08-26 09:06:00.019439+00
1	1822	1209242	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:35:00.015504+00	2025-08-26 09:35:00.017155+00
1	1817	1208914	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:30:00.014701+00	2025-08-26 09:30:00.016262+00
1	1803	1208383	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:16:00.015021+00	2025-08-26 09:16:00.016734+00
1	1794	1207986	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:07:00.015321+00	2025-08-26 09:07:00.016745+00
1	1811	1208768	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:24:00.015097+00	2025-08-26 09:24:00.016646+00
1	1795	1208000	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:08:00.018142+00	2025-08-26 09:08:00.019632+00
1	1804	1208407	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:17:00.014552+00	2025-08-26 09:17:00.016109+00
1	1796	1208032	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:09:00.016454+00	2025-08-26 09:09:00.018061+00
1	1826	1209327	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:39:00.015762+00	2025-08-26 09:39:00.018037+00
1	1797	1208044	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:10:00.014991+00	2025-08-26 09:10:00.0165+00
1	1805	1208433	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:18:00.01876+00	2025-08-26 09:18:00.020358+00
1	1812	1208780	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:25:00.014827+00	2025-08-26 09:25:00.016358+00
1	1798	1208071	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:11:00.0151+00	2025-08-26 09:11:00.016556+00
1	1818	1209122	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:31:00.021403+00	2025-08-26 09:31:00.026687+00
1	1806	1208452	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:19:00.01472+00	2025-08-26 09:19:00.016293+00
1	1813	1208801	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:26:00.015655+00	2025-08-26 09:26:00.017181+00
1	1807	1208477	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:20:00.014197+00	2025-08-26 09:20:00.015854+00
1	1823	1209263	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:36:00.014735+00	2025-08-26 09:36:00.016278+00
1	1819	1209183	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:32:00.014736+00	2025-08-26 09:32:00.01638+00
1	1814	1208826	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:27:00.01482+00	2025-08-26 09:27:00.016468+00
1	1838	1209767	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:51:00.014791+00	2025-08-26 09:51:00.016349+00
1	1832	1209678	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:45:00.137292+00	2025-08-26 09:45:00.15069+00
1	1827	1209339	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:40:00.015146+00	2025-08-26 09:40:00.01668+00
1	1815	1208858	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:28:00.018566+00	2025-08-26 09:28:00.020108+00
1	1820	1209217	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:33:00.018447+00	2025-08-26 09:33:00.021852+00
1	1824	1209295	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:37:00.03607+00	2025-08-26 09:37:00.038223+00
1	1830	1209417	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:43:00.018076+00	2025-08-26 09:43:00.019758+00
1	1825	1209307	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:38:00.017178+00	2025-08-26 09:38:00.018729+00
1	1828	1209384	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:41:00.015408+00	2025-08-26 09:41:00.016973+00
1	1834	1209712	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:47:00.014833+00	2025-08-26 09:47:00.016351+00
1	1833	1209696	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:46:00.016383+00	2025-08-26 09:46:00.018048+00
1	1831	1209474	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:44:00.015723+00	2025-08-26 09:44:00.017434+00
1	1839	1209783	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:52:00.015321+00	2025-08-26 09:52:00.016964+00
1	1837	1209752	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:50:00.014905+00	2025-08-26 09:50:00.016424+00
1	1836	1209740	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:49:00.014968+00	2025-08-26 09:49:00.016597+00
1	1840	1209815	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:53:00.018082+00	2025-08-26 09:53:00.019642+00
1	1841	1209828	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:54:00.015539+00	2025-08-26 09:54:00.017141+00
1	1842	1210028	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:55:00.149008+00	2025-08-26 09:55:00.156994+00
1	1843	1210053	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:56:00.015169+00	2025-08-26 09:56:00.016727+00
1	1844	1210076	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:57:00.014279+00	2025-08-26 09:57:00.015839+00
1	1845	1210097	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:58:00.018877+00	2025-08-26 09:58:00.020417+00
1	1880	1211432	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:33:00.01791+00	2025-08-26 10:33:00.019441+00
1	1867	1210873	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:20:00.014807+00	2025-08-26 10:20:00.016555+00
1	1846	1210109	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 09:59:00.017231+00	2025-08-26 09:59:00.018916+00
1	1858	1210551	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:11:00.014937+00	2025-08-26 10:11:00.016457+00
1	1847	1210122	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:00:00.015522+00	2025-08-26 10:00:00.017194+00
1	1894	1211816	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:47:00.016002+00	2025-08-26 10:47:00.017631+00
1	1875	1211175	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:28:00.018912+00	2025-08-26 10:28:00.020663+00
1	1859	1210566	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:12:00.015362+00	2025-08-26 10:12:00.016985+00
1	1848	1210140	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:01:00.014526+00	2025-08-26 10:01:00.01613+00
1	1868	1210889	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:21:00.014991+00	2025-08-26 10:21:00.016591+00
1	1849	1210163	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:02:00.014602+00	2025-08-26 10:02:00.016231+00
1	1860	1210774	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:13:00.022187+00	2025-08-26 10:13:00.027195+00
1	1850	1210371	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:03:00.027446+00	2025-08-26 10:03:00.03318+00
1	1888	1211543	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:41:00.014894+00	2025-08-26 10:41:00.01649+00
1	1869	1210904	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:22:00.014868+00	2025-08-26 10:22:00.016564+00
1	1851	1210403	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:04:00.015012+00	2025-08-26 10:04:00.016677+00
1	1861	1210787	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:14:00.015651+00	2025-08-26 10:14:00.017232+00
1	1852	1210415	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:05:00.014533+00	2025-08-26 10:05:00.016087+00
1	1881	1211444	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:34:00.01474+00	2025-08-26 10:34:00.01634+00
1	1876	1211187	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:29:00.014223+00	2025-08-26 10:29:00.01578+00
1	1862	1210799	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:15:00.015812+00	2025-08-26 10:15:00.01751+00
1	1853	1210471	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:06:00.014542+00	2025-08-26 10:06:00.016104+00
1	1870	1211103	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:23:00.080556+00	2025-08-26 10:23:00.087962+00
1	1854	1210488	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:07:00.014637+00	2025-08-26 10:07:00.016136+00
1	1863	1210817	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:16:00.014348+00	2025-08-26 10:16:00.015889+00
1	1855	1210512	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:08:00.017091+00	2025-08-26 10:08:00.01874+00
1	1885	1211503	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:38:00.017244+00	2025-08-26 10:38:00.018773+00
1	1856	1210524	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:09:00.014349+00	2025-08-26 10:09:00.015965+00
1	1864	1210832	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:17:00.015022+00	2025-08-26 10:17:00.016664+00
1	1871	1211115	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:24:00.01963+00	2025-08-26 10:24:00.021204+00
1	1857	1210536	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:10:00.014744+00	2025-08-26 10:10:00.016459+00
1	1877	1211199	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:30:00.014782+00	2025-08-26 10:30:00.016326+00
1	1865	1210848	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:18:00.016528+00	2025-08-26 10:18:00.018078+00
1	1872	1211127	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:25:00.014559+00	2025-08-26 10:25:00.01617+00
1	1866	1210861	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:19:00.01634+00	2025-08-26 10:19:00.017861+00
1	1882	1211456	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:35:00.014887+00	2025-08-26 10:35:00.01642+00
1	1878	1211404	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:31:00.062118+00	2025-08-26 10:31:00.069202+00
1	1873	1211147	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:26:00.014143+00	2025-08-26 10:26:00.0157+00
1	1897	1211856	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:50:00.014597+00	2025-08-26 10:50:00.016071+00
1	1891	1211691	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:44:00.023853+00	2025-08-26 10:44:00.02856+00
1	1886	1211515	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:39:00.015175+00	2025-08-26 10:39:00.016701+00
1	1874	1211163	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:27:00.015955+00	2025-08-26 10:27:00.017594+00
1	1879	1211419	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:32:00.014649+00	2025-08-26 10:32:00.016178+00
1	1883	1211474	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:36:00.017004+00	2025-08-26 10:36:00.018513+00
1	1889	1211558	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:42:00.015544+00	2025-08-26 10:42:00.017134+00
1	1884	1211490	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:37:00.014525+00	2025-08-26 10:37:00.016005+00
1	1887	1211527	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:40:00.015954+00	2025-08-26 10:40:00.017443+00
1	1893	1211801	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:46:00.01654+00	2025-08-26 10:46:00.018004+00
1	1892	1211783	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:45:00.016324+00	2025-08-26 10:45:00.019716+00
1	1890	1211571	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:43:00.016452+00	2025-08-26 10:43:00.018013+00
1	1898	1211872	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:51:00.014653+00	2025-08-26 10:51:00.016137+00
1	1896	1211843	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:49:00.014645+00	2025-08-26 10:49:00.016187+00
1	1895	1211829	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:48:00.017052+00	2025-08-26 10:48:00.018536+00
1	1899	1211887	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:52:00.015381+00	2025-08-26 10:52:00.017802+00
1	1900	1212085	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:53:00.072095+00	2025-08-26 10:53:00.078158+00
1	1901	1212097	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:54:00.014954+00	2025-08-26 10:54:00.016481+00
1	1902	1212110	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:55:00.014635+00	2025-08-26 10:55:00.016092+00
1	1903	1212129	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:56:00.01493+00	2025-08-26 10:56:00.017076+00
1	1904	1212141	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:57:00.016339+00	2025-08-26 10:57:00.01789+00
1	1939	1213385	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:32:00.103281+00	2025-08-26 11:32:00.160819+00
1	1926	1212828	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:19:00.01618+00	2025-08-26 11:19:00.017657+00
1	1905	1212157	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:58:00.019984+00	2025-08-26 10:58:00.021536+00
1	1917	1212510	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:10:00.015414+00	2025-08-26 11:10:00.017+00
1	1906	1212169	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 10:59:00.014289+00	2025-08-26 10:59:00.015729+00
1	1953	1213809	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:46:00.015543+00	2025-08-26 11:46:00.01742+00
1	1934	1213126	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:27:00.016587+00	2025-08-26 11:27:00.018115+00
1	1918	1212525	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:11:00.015206+00	2025-08-26 11:11:00.017729+00
1	1907	1212181	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:00:00.016652+00	2025-08-26 11:00:00.018225+00
1	1927	1212840	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:20:00.015046+00	2025-08-26 11:20:00.016565+00
1	1908	1212197	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:01:00.014171+00	2025-08-26 11:01:00.015686+00
1	1919	1212538	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:12:00.01667+00	2025-08-26 11:12:00.018271+00
1	1909	1212210	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:02:00.015914+00	2025-08-26 11:02:00.0175+00
1	1947	1213527	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:40:00.014837+00	2025-08-26 11:40:00.016524+00
1	1928	1212855	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:21:00.015581+00	2025-08-26 11:21:00.017192+00
1	1910	1212225	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:03:00.016326+00	2025-08-26 11:03:00.018052+00
1	1920	1212553	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:13:00.016062+00	2025-08-26 11:13:00.018481+00
1	1911	1212426	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:04:00.123803+00	2025-08-26 11:04:00.133865+00
1	1940	1213400	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:33:00.018308+00	2025-08-26 11:33:00.020074+00
1	1935	1213142	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:28:00.017406+00	2025-08-26 11:28:00.018962+00
1	1921	1212754	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:14:00.026495+00	2025-08-26 11:14:00.033323+00
1	1912	1212438	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:05:00.017238+00	2025-08-26 11:05:00.018848+00
1	1929	1213056	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:22:00.164294+00	2025-08-26 11:22:00.174553+00
1	1913	1212456	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:06:00.017025+00	2025-08-26 11:06:00.018694+00
1	1922	1212766	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:15:00.016429+00	2025-08-26 11:15:00.018076+00
1	1914	1212469	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:07:00.014544+00	2025-08-26 11:07:00.016061+00
1	1944	1213486	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:37:00.040003+00	2025-08-26 11:37:00.04537+00
1	1915	1212484	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:08:00.017604+00	2025-08-26 11:08:00.019159+00
1	1923	1212784	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:16:00.014812+00	2025-08-26 11:16:00.016244+00
1	1930	1213071	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:23:00.018826+00	2025-08-26 11:23:00.020362+00
1	1916	1212497	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:09:00.015462+00	2025-08-26 11:09:00.016949+00
1	1936	1213154	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:29:00.016009+00	2025-08-26 11:29:00.017581+00
1	1924	1212796	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:17:00.01661+00	2025-08-26 11:17:00.018125+00
1	1931	1213084	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:24:00.01623+00	2025-08-26 11:24:00.01798+00
1	1925	1212816	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:18:00.017607+00	2025-08-26 11:18:00.019122+00
1	1941	1213431	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:34:00.015721+00	2025-08-26 11:34:00.017394+00
1	1937	1213168	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:30:00.014847+00	2025-08-26 11:30:00.01634+00
1	1932	1213096	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:25:00.016025+00	2025-08-26 11:25:00.017682+00
1	1956	1213883	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:49:00.015103+00	2025-08-26 11:49:00.01676+00
1	1950	1213762	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:43:00.021274+00	2025-08-26 11:43:00.023546+00
1	1945	1213503	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:38:00.017813+00	2025-08-26 11:38:00.019661+00
1	1933	1213114	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:26:00.014814+00	2025-08-26 11:26:00.0169+00
1	1938	1213185	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:31:00.015711+00	2025-08-26 11:31:00.01735+00
1	1942	1213444	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:35:00.014581+00	2025-08-26 11:35:00.016236+00
1	1948	1213543	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:41:00.016184+00	2025-08-26 11:41:00.017873+00
1	1943	1213462	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:36:00.014752+00	2025-08-26 11:36:00.016429+00
1	1946	1213515	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:39:00.014964+00	2025-08-26 11:39:00.016622+00
1	1952	1213791	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:45:00.015746+00	2025-08-26 11:45:00.017412+00
1	1951	1213778	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:44:00.014933+00	2025-08-26 11:44:00.016574+00
1	1949	1213743	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:42:00.036966+00	2025-08-26 11:42:00.04253+00
1	1957	1213916	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:50:00.015128+00	2025-08-26 11:50:00.016764+00
1	1955	1213862	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:48:00.017741+00	2025-08-26 11:48:00.01978+00
1	1954	1213830	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:47:00.01479+00	2025-08-26 11:47:00.016414+00
1	1958	1213943	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:51:00.014802+00	2025-08-26 11:51:00.016462+00
1	1959	1213973	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:52:00.015296+00	2025-08-26 11:52:00.016996+00
1	1960	1214003	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:53:00.017199+00	2025-08-26 11:53:00.019543+00
1	1961	1214033	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:54:00.015656+00	2025-08-26 11:54:00.017441+00
1	1962	1214241	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:55:00.194818+00	2025-08-26 11:55:00.205318+00
1	1963	1214263	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:56:00.01548+00	2025-08-26 11:56:00.017251+00
1	1998	1215652	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:31:00.014487+00	2025-08-26 12:31:00.016099+00
1	1985	1215261	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:18:00.016983+00	2025-08-26 12:18:00.018648+00
1	1964	1214296	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:57:00.01788+00	2025-08-26 11:57:00.019829+00
1	1976	1214915	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:09:00.013798+00	2025-08-26 12:09:00.015445+00
1	1965	1214335	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:58:00.015328+00	2025-08-26 11:58:00.016979+00
11	2010	1243805	postgres	postgres	BEGIN;\r\nREFRESH MATERIALIZED VIEW public.mv_all_time_leaderboard;\r\nREFRESH MATERIALIZED VIEW public.mv_daily_active_users;\r\nREFRESH MATERIALIZED VIEW public.mv_daily_coins_flow;\r\nREFRESH MATERIALIZED VIEW public.mv_weekly_coins_flow;\r\nREFRESH MATERIALIZED VIEW public.mv_redemption_stats;\r\nREFRESH MATERIALIZED VIEW public.mv_winners_report;\r\nCOMMIT;	succeeded	COMMIT	2025-08-27 03:00:00.230207+00	2025-08-27 03:00:00.913525+00
1	1993	1215585	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:26:00.015624+00	2025-08-26 12:26:00.017474+00
1	1977	1214927	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:10:00.01492+00	2025-08-26 12:10:00.016677+00
1	1966	1214373	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 11:59:00.014476+00	2025-08-26 11:59:00.01672+00
1	1986	1215296	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:19:00.021596+00	2025-08-26 12:19:00.023285+00
1	1967	1214390	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:00:00.015436+00	2025-08-26 12:00:00.01722+00
1	1978	1214954	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:11:00.015209+00	2025-08-26 12:11:00.016958+00
1	1968	1214427	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:01:00.014851+00	2025-08-26 12:01:00.016745+00
1	2006	1215966	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:39:00.014491+00	2025-08-26 12:39:00.016882+00
1	1987	1215309	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:20:00.015126+00	2025-08-26 12:20:00.016749+00
1	1969	1214459	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:02:00.014856+00	2025-08-26 12:02:00.016503+00
1	1979	1214975	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:12:00.014884+00	2025-08-26 12:12:00.01656+00
1	1970	1214472	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:03:00.01667+00	2025-08-26 12:03:00.018352+00
1	1999	1215664	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:32:00.014071+00	2025-08-26 12:32:00.015709+00
1	1994	1215597	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:27:00.014992+00	2025-08-26 12:27:00.016721+00
1	1980	1214987	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:13:00.016277+00	2025-08-26 12:13:00.018018+00
1	1971	1214571	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:04:00.019825+00	2025-08-26 12:04:00.022188+00
1	1988	1215514	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:21:00.02459+00	2025-08-26 12:21:00.030744+00
1	1972	1214740	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:05:00.049689+00	2025-08-26 12:05:00.053696+00
1	1981	1215003	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:14:00.014278+00	2025-08-26 12:14:00.01596+00
1	1973	1214812	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:06:00.014576+00	2025-08-26 12:06:00.016197+00
1	2003	1215910	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:36:00.01514+00	2025-08-26 12:36:00.016822+00
1	1974	1214838	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:07:00.015172+00	2025-08-26 12:07:00.016756+00
1	1982	1215029	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:15:00.020175+00	2025-08-26 12:15:00.022061+00
1	1989	1215526	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:22:00.014381+00	2025-08-26 12:22:00.016031+00
1	1975	1214873	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:08:00.016115+00	2025-08-26 12:08:00.017769+00
1	1995	1215609	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:28:00.017077+00	2025-08-26 12:28:00.018951+00
1	1983	1215220	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:16:00.073937+00	2025-08-26 12:16:00.081147+00
1	1990	1215539	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:23:00.015763+00	2025-08-26 12:23:00.017447+00
1	1984	1215242	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:17:00.014856+00	2025-08-26 12:17:00.016538+00
1	2000	1215864	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:33:00.088001+00	2025-08-26 12:33:00.093969+00
1	1996	1215624	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:29:00.014582+00	2025-08-26 12:29:00.01626+00
1	1991	1215554	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:24:00.015019+00	2025-08-26 12:24:00.016648+00
1	2004	1215922	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:37:00.014951+00	2025-08-26 12:37:00.016694+00
1	1992	1215566	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:25:00.01541+00	2025-08-26 12:25:00.017145+00
1	1997	1215636	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:30:00.015164+00	2025-08-26 12:30:00.016939+00
1	2001	1215877	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:34:00.015129+00	2025-08-26 12:34:00.016792+00
1	2002	1215892	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:35:00.015527+00	2025-08-26 12:35:00.017241+00
1	2005	1215949	postgres	postgres	select process_pending_quizzes();	succeeded	1 row	2025-08-26 12:38:00.016042+00	2025-08-26 12:38:00.018564+00
8	2007	1238058	postgres	postgres	refresh materialized view concurrently mv_winners_report;	succeeded	REFRESH MATERIALIZED VIEW	2025-08-27 00:00:00.223037+00	2025-08-27 00:00:00.527423+00
12	2011	1248727	postgres	postgres	CALL public.refresh_leaderboards_all();	succeeded	CALL	2025-08-27 05:30:00.235374+00	2025-08-27 05:30:00.744956+00
8	2012	1286135	postgres	postgres	refresh materialized view concurrently mv_winners_report;	succeeded	REFRESH MATERIALIZED VIEW	2025-08-28 00:00:00.258988+00	2025-08-28 00:00:00.577965+00
3	2009	1238060	postgres	postgres	 select refresh_analytics(); 	succeeded	1 row	2025-08-27 00:00:00.229549+00	2025-08-27 00:00:00.638755+00
6	2008	1238059	postgres	postgres	refresh materialized view mv_winners_report;	succeeded	REFRESH MATERIALIZED VIEW	2025-08-27 00:00:00.226606+00	2025-08-27 00:00:00.694004+00
3	2014	1286137	postgres	postgres	 select refresh_analytics(); 	succeeded	1 row	2025-08-28 00:00:00.261169+00	2025-08-28 00:00:00.655618+00
6	2013	1286136	postgres	postgres	refresh materialized view mv_winners_report;	succeeded	REFRESH MATERIALIZED VIEW	2025-08-28 00:00:00.256813+00	2025-08-28 00:00:00.709284+00
3	2019	1334266	postgres	postgres	 select refresh_analytics(); 	succeeded	1 row	2025-08-29 00:00:00.268682+00	2025-08-29 00:00:00.6397+00
6	2018	1334265	postgres	postgres	refresh materialized view mv_winners_report;	succeeded	REFRESH MATERIALIZED VIEW	2025-08-29 00:00:00.257303+00	2025-08-29 00:00:00.716816+00
12	2021	1345203	postgres	postgres	CALL public.refresh_leaderboards_all();	succeeded	CALL	2025-08-29 05:30:00.209381+00	2025-08-29 05:30:00.381957+00
11	2032	1437290	postgres	postgres	BEGIN;\r\nREFRESH MATERIALIZED VIEW public.mv_all_time_leaderboard;\r\nREFRESH MATERIALIZED VIEW public.mv_daily_active_users;\r\nREFRESH MATERIALIZED VIEW public.mv_daily_coins_flow;\r\nREFRESH MATERIALIZED VIEW public.mv_weekly_coins_flow;\r\nREFRESH MATERIALIZED VIEW public.mv_redemption_stats;\r\nREFRESH MATERIALIZED VIEW public.mv_winners_report;\r\nCOMMIT;	failed	ERROR:  relation "public.mv_all_time_leaderboard" does not exist\n	2025-08-31 03:00:00.244504+00	2025-08-31 03:00:00.256523+00
11	2015	1291939	postgres	postgres	BEGIN;\r\nREFRESH MATERIALIZED VIEW public.mv_all_time_leaderboard;\r\nREFRESH MATERIALIZED VIEW public.mv_daily_active_users;\r\nREFRESH MATERIALIZED VIEW public.mv_daily_coins_flow;\r\nREFRESH MATERIALIZED VIEW public.mv_weekly_coins_flow;\r\nREFRESH MATERIALIZED VIEW public.mv_redemption_stats;\r\nREFRESH MATERIALIZED VIEW public.mv_winners_report;\r\nCOMMIT;	succeeded	COMMIT	2025-08-28 03:00:00.240071+00	2025-08-28 03:00:00.866691+00
8	2041	1527310	postgres	postgres	refresh materialized view concurrently mv_winners_report;	succeeded	REFRESH MATERIALIZED VIEW	2025-09-02 00:00:00.274852+00	2025-09-02 00:00:00.570094+00
11	2025	1389236	postgres	postgres	BEGIN;\r\nREFRESH MATERIALIZED VIEW public.mv_all_time_leaderboard;\r\nREFRESH MATERIALIZED VIEW public.mv_daily_active_users;\r\nREFRESH MATERIALIZED VIEW public.mv_daily_coins_flow;\r\nREFRESH MATERIALIZED VIEW public.mv_weekly_coins_flow;\r\nREFRESH MATERIALIZED VIEW public.mv_redemption_stats;\r\nREFRESH MATERIALIZED VIEW public.mv_winners_report;\r\nCOMMIT;	succeeded	COMMIT	2025-08-30 03:00:00.23076+00	2025-08-30 03:00:00.81079+00
12	2016	1297157	postgres	postgres	CALL public.refresh_leaderboards_all();	succeeded	CALL	2025-08-28 05:30:00.235243+00	2025-08-28 05:30:00.845407+00
4	2029	1431481	postgres	postgres	select award_weekly_winners();	succeeded	1 row	2025-08-31 00:00:00.2769+00	2025-08-31 00:00:00.437784+00
11	2020	1340057	postgres	postgres	BEGIN;\r\nREFRESH MATERIALIZED VIEW public.mv_all_time_leaderboard;\r\nREFRESH MATERIALIZED VIEW public.mv_daily_active_users;\r\nREFRESH MATERIALIZED VIEW public.mv_daily_coins_flow;\r\nREFRESH MATERIALIZED VIEW public.mv_weekly_coins_flow;\r\nREFRESH MATERIALIZED VIEW public.mv_redemption_stats;\r\nREFRESH MATERIALIZED VIEW public.mv_winners_report;\r\nCOMMIT;	succeeded	COMMIT	2025-08-29 03:00:00.232188+00	2025-08-29 03:00:00.809765+00
8	2027	1431479	postgres	postgres	refresh materialized view concurrently mv_winners_report;	succeeded	REFRESH MATERIALIZED VIEW	2025-08-31 00:00:00.274711+00	2025-08-31 00:00:00.481236+00
9	2031	1431483	postgres	postgres	select take_winners_snapshot();	succeeded	1 row	2025-08-31 00:00:00.281415+00	2025-08-31 00:00:00.542581+00
12	2026	1394265	postgres	postgres	CALL public.refresh_leaderboards_all();	succeeded	CALL	2025-08-30 05:30:00.213005+00	2025-08-30 05:30:00.376735+00
8	2022	1383427	postgres	postgres	refresh materialized view concurrently mv_winners_report;	succeeded	REFRESH MATERIALIZED VIEW	2025-08-30 00:00:00.262558+00	2025-08-30 00:00:00.561966+00
3	2024	1383429	postgres	postgres	 select refresh_analytics(); 	succeeded	1 row	2025-08-30 00:00:00.27051+00	2025-08-30 00:00:00.700049+00
8	2017	1334264	postgres	postgres	refresh materialized view concurrently mv_winners_report;	succeeded	REFRESH MATERIALIZED VIEW	2025-08-29 00:00:00.253837+00	2025-08-29 00:00:00.557588+00
6	2023	1383428	postgres	postgres	refresh materialized view mv_winners_report;	succeeded	REFRESH MATERIALIZED VIEW	2025-08-30 00:00:00.267191+00	2025-08-30 00:00:00.796886+00
11	2039	1485028	postgres	postgres	BEGIN;\r\nREFRESH MATERIALIZED VIEW public.mv_all_time_leaderboard;\r\nREFRESH MATERIALIZED VIEW public.mv_daily_active_users;\r\nREFRESH MATERIALIZED VIEW public.mv_daily_coins_flow;\r\nREFRESH MATERIALIZED VIEW public.mv_weekly_coins_flow;\r\nREFRESH MATERIALIZED VIEW public.mv_redemption_stats;\r\nREFRESH MATERIALIZED VIEW public.mv_winners_report;\r\nCOMMIT;	failed	ERROR:  relation "public.mv_all_time_leaderboard" does not exist\n	2025-09-01 03:00:00.212558+00	2025-09-01 03:00:00.215335+00
3	2030	1431482	postgres	postgres	 select refresh_analytics(); 	failed	ERROR:  relation "mv_all_time_leaderboard" does not exist\nCONTEXT:  SQL statement "refresh materialized view concurrently mv_all_time_leaderboard"\nPL/pgSQL function refresh_analytics() line 13 at SQL statement\n	2025-08-31 00:00:00.277967+00	2025-08-31 00:00:00.554462+00
12	2040	1489985	postgres	postgres	CALL public.refresh_leaderboards_all();	failed	ERROR:  relation "public.mv_all_time_leaderboard" does not exist\nCONTEXT:  SQL statement "REFRESH MATERIALIZED VIEW public.mv_all_time_leaderboard"\nPL/pgSQL function refresh_leaderboards_all() line 3 at SQL statement\n	2025-09-01 05:30:00.217962+00	2025-09-01 05:30:00.224487+00
6	2028	1431480	postgres	postgres	refresh materialized view mv_winners_report;	succeeded	REFRESH MATERIALIZED VIEW	2025-08-31 00:00:00.266188+00	2025-08-31 00:00:00.730093+00
12	2033	1442498	postgres	postgres	CALL public.refresh_leaderboards_all();	failed	ERROR:  relation "public.mv_all_time_leaderboard" does not exist\nCONTEXT:  SQL statement "REFRESH MATERIALIZED VIEW public.mv_all_time_leaderboard"\nPL/pgSQL function refresh_leaderboards_all() line 3 at SQL statement\n	2025-08-31 05:30:00.254524+00	2025-08-31 05:30:00.28585+00
3	2043	1527312	postgres	postgres	 select refresh_analytics(); 	failed	ERROR:  relation "mv_all_time_leaderboard" does not exist\nCONTEXT:  SQL statement "refresh materialized view concurrently mv_all_time_leaderboard"\nPL/pgSQL function refresh_analytics() line 13 at SQL statement\n	2025-09-02 00:00:00.28259+00	2025-09-02 00:00:00.597972+00
6	2042	1527311	postgres	postgres	refresh materialized view mv_winners_report;	succeeded	REFRESH MATERIALIZED VIEW	2025-09-02 00:00:00.281458+00	2025-09-02 00:00:00.624182+00
5	2036	1478702	postgres	postgres	select award_monthly_winners();	succeeded	1 row	2025-09-01 00:00:00.298789+00	2025-09-01 00:00:00.465372+00
8	2034	1478700	postgres	postgres	refresh materialized view concurrently mv_winners_report;	succeeded	REFRESH MATERIALIZED VIEW	2025-09-01 00:00:00.303813+00	2025-09-01 00:00:00.522502+00
10	2038	1478704	postgres	postgres	select take_winners_snapshot();	succeeded	1 row	2025-09-01 00:00:00.312368+00	2025-09-01 00:00:00.577757+00
3	2037	1478703	postgres	postgres	 select refresh_analytics(); 	failed	ERROR:  relation "mv_all_time_leaderboard" does not exist\nCONTEXT:  SQL statement "refresh materialized view concurrently mv_all_time_leaderboard"\nPL/pgSQL function refresh_analytics() line 13 at SQL statement\n	2025-09-01 00:00:00.30746+00	2025-09-01 00:00:00.587325+00
6	2035	1478701	postgres	postgres	refresh materialized view mv_winners_report;	succeeded	REFRESH MATERIALIZED VIEW	2025-09-01 00:00:00.297705+00	2025-09-01 00:00:00.806165+00
11	2044	1533140	postgres	postgres	BEGIN;\r\nREFRESH MATERIALIZED VIEW public.mv_all_time_leaderboard;\r\nREFRESH MATERIALIZED VIEW public.mv_daily_active_users;\r\nREFRESH MATERIALIZED VIEW public.mv_daily_coins_flow;\r\nREFRESH MATERIALIZED VIEW public.mv_weekly_coins_flow;\r\nREFRESH MATERIALIZED VIEW public.mv_redemption_stats;\r\nREFRESH MATERIALIZED VIEW public.mv_winners_report;\r\nCOMMIT;	failed	ERROR:  relation "public.mv_all_time_leaderboard" does not exist\n	2025-09-02 03:00:00.227513+00	2025-09-02 03:00:00.234196+00
12	2060	1683593	postgres	postgres	CALL public.refresh_leaderboards_all();	failed	ERROR:  relation "public.mv_all_time_leaderboard" does not exist\nCONTEXT:  SQL statement "REFRESH MATERIALIZED VIEW public.mv_all_time_leaderboard"\nPL/pgSQL function refresh_leaderboards_all() line 3 at SQL statement\n	2025-09-05 05:30:00.217281+00	2025-09-05 05:30:00.245471+00
12	2045	1537998	postgres	postgres	CALL public.refresh_leaderboards_all();	failed	ERROR:  relation "public.mv_all_time_leaderboard" does not exist\nCONTEXT:  SQL statement "REFRESH MATERIALIZED VIEW public.mv_all_time_leaderboard"\nPL/pgSQL function refresh_leaderboards_all() line 3 at SQL statement\n	2025-09-02 05:30:00.239587+00	2025-09-02 05:30:00.269679+00
12	2055	1633518	postgres	postgres	CALL public.refresh_leaderboards_all();	failed	ERROR:  relation "public.mv_all_time_leaderboard" does not exist\nCONTEXT:  SQL statement "REFRESH MATERIALIZED VIEW public.mv_all_time_leaderboard"\nPL/pgSQL function refresh_leaderboards_all() line 3 at SQL statement\n	2025-09-04 05:30:00.248456+00	2025-09-04 05:30:00.277268+00
11	2059	1678755	postgres	postgres	BEGIN;\r\nREFRESH MATERIALIZED VIEW public.mv_all_time_leaderboard;\r\nREFRESH MATERIALIZED VIEW public.mv_daily_active_users;\r\nREFRESH MATERIALIZED VIEW public.mv_daily_coins_flow;\r\nREFRESH MATERIALIZED VIEW public.mv_weekly_coins_flow;\r\nREFRESH MATERIALIZED VIEW public.mv_redemption_stats;\r\nREFRESH MATERIALIZED VIEW public.mv_winners_report;\r\nCOMMIT;	failed	ERROR:  relation "public.mv_all_time_leaderboard" does not exist\n	2025-09-05 03:00:00.25232+00	2025-09-05 03:00:00.264354+00
8	2051	1622514	postgres	postgres	refresh materialized view concurrently mv_winners_report;	succeeded	REFRESH MATERIALIZED VIEW	2025-09-04 00:00:00.265093+00	2025-09-04 00:00:00.583237+00
8	2046	1575395	postgres	postgres	refresh materialized view concurrently mv_winners_report;	succeeded	REFRESH MATERIALIZED VIEW	2025-09-03 00:00:00.263228+00	2025-09-03 00:00:00.564459+00
3	2048	1575397	postgres	postgres	 select refresh_analytics(); 	failed	ERROR:  relation "mv_all_time_leaderboard" does not exist\nCONTEXT:  SQL statement "refresh materialized view concurrently mv_all_time_leaderboard"\nPL/pgSQL function refresh_analytics() line 13 at SQL statement\n	2025-09-03 00:00:00.269534+00	2025-09-03 00:00:00.593942+00
6	2047	1575396	postgres	postgres	refresh materialized view mv_winners_report;	succeeded	REFRESH MATERIALIZED VIEW	2025-09-03 00:00:00.26432+00	2025-09-03 00:00:00.682172+00
3	2053	1622516	postgres	postgres	 select refresh_analytics(); 	failed	ERROR:  relation "mv_all_time_leaderboard" does not exist\nCONTEXT:  SQL statement "refresh materialized view concurrently mv_all_time_leaderboard"\nPL/pgSQL function refresh_analytics() line 13 at SQL statement\n	2025-09-04 00:00:00.272092+00	2025-09-04 00:00:00.616032+00
6	2052	1622515	postgres	postgres	refresh materialized view mv_winners_report;	succeeded	REFRESH MATERIALIZED VIEW	2025-09-04 00:00:00.270974+00	2025-09-04 00:00:00.7561+00
11	2049	1581220	postgres	postgres	BEGIN;\r\nREFRESH MATERIALIZED VIEW public.mv_all_time_leaderboard;\r\nREFRESH MATERIALIZED VIEW public.mv_daily_active_users;\r\nREFRESH MATERIALIZED VIEW public.mv_daily_coins_flow;\r\nREFRESH MATERIALIZED VIEW public.mv_weekly_coins_flow;\r\nREFRESH MATERIALIZED VIEW public.mv_redemption_stats;\r\nREFRESH MATERIALIZED VIEW public.mv_winners_report;\r\nCOMMIT;	failed	ERROR:  relation "public.mv_all_time_leaderboard" does not exist\n	2025-09-03 03:00:00.229339+00	2025-09-03 03:00:00.236193+00
12	2050	1586132	postgres	postgres	CALL public.refresh_leaderboards_all();	failed	ERROR:  relation "public.mv_all_time_leaderboard" does not exist\nCONTEXT:  SQL statement "REFRESH MATERIALIZED VIEW public.mv_all_time_leaderboard"\nPL/pgSQL function refresh_leaderboards_all() line 3 at SQL statement\n	2025-09-03 05:30:00.208406+00	2025-09-03 05:30:00.211716+00
11	2054	1628307	postgres	postgres	BEGIN;\r\nREFRESH MATERIALIZED VIEW public.mv_all_time_leaderboard;\r\nREFRESH MATERIALIZED VIEW public.mv_daily_active_users;\r\nREFRESH MATERIALIZED VIEW public.mv_daily_coins_flow;\r\nREFRESH MATERIALIZED VIEW public.mv_weekly_coins_flow;\r\nREFRESH MATERIALIZED VIEW public.mv_redemption_stats;\r\nREFRESH MATERIALIZED VIEW public.mv_winners_report;\r\nCOMMIT;	failed	ERROR:  relation "public.mv_all_time_leaderboard" does not exist\n	2025-09-04 03:00:00.24152+00	2025-09-04 03:00:00.252038+00
8	2056	1671974	postgres	postgres	refresh materialized view concurrently mv_winners_report;	succeeded	REFRESH MATERIALIZED VIEW	2025-09-05 00:00:00.235324+00	2025-09-05 00:00:00.293133+00
6	2057	1671975	postgres	postgres	refresh materialized view mv_winners_report;	succeeded	REFRESH MATERIALIZED VIEW	2025-09-05 00:00:00.244538+00	2025-09-05 00:00:00.321793+00
3	2058	1671976	postgres	postgres	 select refresh_analytics(); 	failed	ERROR:  relation "mv_all_time_leaderboard" does not exist\nCONTEXT:  SQL statement "refresh materialized view concurrently mv_all_time_leaderboard"\nPL/pgSQL function refresh_analytics() line 13 at SQL statement\n	2025-09-05 00:00:00.242914+00	2025-09-05 00:00:00.33255+00
\.


--
-- Data for Name: feature_info; Type: TABLE DATA; Schema: pgtle; Owner: -
--

COPY pgtle.feature_info (feature, schema_name, proname, obj_identity) FROM stdin;
\.


--
-- Data for Name: daily_streaks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.daily_streaks (id, user_id, login_date, coins_earned, streak_day, created_at) FROM stdin;
966be45d-cb34-4b9a-a23d-9beb0ff40db4	0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf	2025-08-30	10	1	2025-08-30 18:21:50.713451+00
e7e2b307-46c8-4171-a04e-ca7034d4d428	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-08-30	10	1	2025-08-30 19:05:12.35846+00
b16c23f1-2d1a-48b3-a5c2-51b9ec12e398	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-08-31	15	2	2025-08-31 17:25:10.118018+00
0e8da5d8-ae99-48d3-a3f0-061151953720	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-09-01	20	3	2025-09-01 03:47:34.929142+00
ad97d882-3f2e-43eb-a6a9-ad2d29e23e0f	c9bac630-48da-42ef-b8ca-68797ed6d652	2025-09-01	10	1	2025-09-01 17:08:03.418092+00
7aafecb9-2476-48fa-9cab-ed33b3b031f9	c9bac630-48da-42ef-b8ca-68797ed6d652	2025-09-02	15	2	2025-09-02 02:38:05.153781+00
a0d4b718-9131-4804-ac85-c1b47224309d	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-09-03	10	1	2025-09-03 02:29:47.755273+00
9cbc0647-2d41-4c14-afe4-61cdc33b39e6	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-09-04	15	2	2025-09-04 05:49:17.653263+00
c0c3dbf3-63ca-4f10-8942-2d5bf5bc21a9	0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf	2025-09-05	10	1	2025-09-05 00:40:25.089684+00
bc93e323-52dd-4c60-a94b-e4c0286b8a37	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-09-05	20	3	2025-09-05 00:41:13.047509+00
55a490d0-9f8c-497f-a865-6ca5a6ec5da5	c9bac630-48da-42ef-b8ca-68797ed6d652	2025-09-05	10	1	2025-09-05 00:46:02.491823+00
5f94ffc4-c973-46e8-a816-7a087624996e	2ff275bd-7b73-4ff7-8a3d-d6a49b57259e	2025-09-05	10	1	2025-09-05 12:16:35.816777+00
af78dd5a-7226-48fe-99dc-3dda8f3048a1	0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf	2025-09-08	10	1	2025-09-08 18:18:40.666966+00
571ff789-cc51-4cc7-bbc8-0556ddf1cf00	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-09-08	10	1	2025-09-08 19:06:42.756983+00
d22d97dc-f9ab-4fff-b295-5901e0925a20	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-09-09	15	2	2025-09-09 15:19:52.298116+00
b3e1af65-1272-401c-997b-d9fd5a39da6b	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-09-10	20	3	2025-09-10 03:55:50.583648+00
60d6d348-da3b-4c3f-8849-2af21d83d3ba	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-09-11	25	4	2025-09-11 03:07:27.259628+00
d81e49d6-ac61-4994-8882-36db004ff171	0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf	2025-09-11	10	1	2025-09-11 08:25:45.732273+00
8f09b075-c77d-4afb-af15-0e855fa769a8	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-09-12	30	5	2025-09-12 01:22:36.492297+00
\.


--
-- Data for Name: levels; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.levels (id, name, min_coins, max_coins) FROM stdin;
1	Bronze	0	100
2	Silver	101	500
3	Gold	501	1000
4	Platinum	1001	\N
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, title, message, type, quiz_id, scheduled_at, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: options; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.options (id, question_id, option_text, updated_at) FROM stdin;
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profiles (id, full_name, role, updated_at, email, total_spent, quizzes_played, quizzes_won, badges, account_status, created_at, level, username, avatar_url, is_profile_complete, notification_enabled, referral_code, referred_by, current_streak, max_streak, last_login_date, mobile_number, total_coins) FROM stdin;
0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf		user	2025-09-11 09:53:55.066568+00	finprimebusiness@gmail.com	0	0	0	{}	active	2025-08-30 18:18:25.28617+00	Bronze	rdsharma	https://gcheopiqayyptfxowulv.supabase.co/storage/v1/object/public/avatars/0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf/1756577912545.jpg	t	f	0BA6D7CB	\N	1	1	2025-09-11		40
d54f5f83-aa63-4630-b9be-dbdca91b9315	Govind	user	2025-09-12 01:22:36.492297+00	sutharji1122@gmail.com	0	0	0	{}	active	2025-08-25 18:08:53.554728+00	Silver	gomu4300000	https://gcheopiqayyptfxowulv.supabase.co/storage/v1/object/public/avatars/d54f5f83-aa63-4630-b9be-dbdca91b9315/1756577551350.jpg	t	f	d54f5f83	\N	5	5	2025-09-12		140
2ff275bd-7b73-4ff7-8a3d-d6a49b57259e	Kartik Suthar	user	2025-09-05 20:33:26.483259+00	\N	0	0	0	{}	active	2025-09-05 12:16:35.193191+00	Bronze	Kartik		t	f	2FF275BD	\N	1	1	2025-09-05		20
c9bac630-48da-42ef-b8ca-68797ed6d652	Govind	admin	2025-09-11 17:56:27.79445+00	quizdangalofficial@gmail.com	0	0	0	{}	active	2025-08-25 18:10:32.747001+00	Bronze	admin	https://gcheopiqayyptfxowulv.supabase.co/storage/v1/object/public/avatars/c9bac630-48da-42ef-b8ca-68797ed6d652/1756746475867.webp	t	f	C9BAC630	\N	1	2	2025-09-05		20
\.


--
-- Data for Name: push_subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.push_subscriptions (id, user_id, subscription_object, created_at) FROM stdin;
\.


--
-- Data for Name: questions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.questions (id, quiz_id, question_text, "position", created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: quiz_participants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quiz_participants (id, user_id, joined_at, quiz_id, score, rank, status, updated_at) FROM stdin;
\.


--
-- Data for Name: quiz_prizes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quiz_prizes (id, quiz_id, rank_from, rank_to, prize_coins, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: quiz_results; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quiz_results (id, quiz_id, leaderboard, created_at, result_shown_at, updated_at, user_id) FROM stdin;
\.


--
-- Data for Name: quizzes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quizzes (id, title, entry_fee, prize_pool, start_time, end_time, result_time, status, prizes, created_at, updated_at, category) FROM stdin;
\.


--
-- Data for Name: redemptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.redemptions (id, user_id, reward_type, reward_value, coins_required, status, requested_at, processed_at, catalog_id) FROM stdin;
\.


--
-- Data for Name: referrals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.referrals (id, referrer_id, referred_id, referral_code, coins_awarded, created_at) FROM stdin;
\.


--
-- Data for Name: reward_catalog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reward_catalog (id, reward_type, reward_value, coins_required, is_active) FROM stdin;
9f226ae1-8cd5-4f45-a400-bcdd9f03c2f2	gift_card	Amazon ₹100 Voucher	100	t
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transactions (id, user_id, type, amount, status, created_at, updated_at, description, reference_id) FROM stdin;
88859efc-efe1-4015-8925-fe82a588296a	c9bac630-48da-42ef-b8ca-68797ed6d652	credit	10	success	2025-09-05 20:33:26.483259+00	2025-09-05 20:33:26.483259+00	Aggregated Past Earnings	\N
192cf159-9f14-46da-b90b-795f8240e004	2ff275bd-7b73-4ff7-8a3d-d6a49b57259e	credit	10	success	2025-09-05 20:33:26.483259+00	2025-09-05 20:33:26.483259+00	Aggregated Past Earnings	\N
4d2e3d76-6a4c-4753-87f9-30cebccd1627	0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf	credit	10	success	2025-09-05 20:33:26.483259+00	2025-09-05 20:33:26.483259+00	Aggregated Past Earnings	\N
a7a50580-985c-4b23-9d15-71ee6b8b5eea	d54f5f83-aa63-4630-b9be-dbdca91b9315	credit	20	success	2025-09-05 20:33:26.483259+00	2025-09-05 20:33:26.483259+00	Aggregated Past Earnings	\N
2cb9bd61-ce8a-450f-a6bb-a79fe9e7f6c5	0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf	daily_login	10	success	2025-09-08 18:18:40.666966+00	2025-09-08 18:18:40.666966+00	Daily login streak day 1	\N
df0782c5-e0c0-46f0-b1fe-e3843ec2bf32	d54f5f83-aa63-4630-b9be-dbdca91b9315	daily_login	10	success	2025-09-08 19:06:42.756983+00	2025-09-08 19:06:42.756983+00	Daily login streak day 1	\N
a1012856-8d8c-4e30-9554-e26c840da2e6	d54f5f83-aa63-4630-b9be-dbdca91b9315	daily_login	15	success	2025-09-09 15:19:52.298116+00	2025-09-09 15:19:52.298116+00	Daily login streak day 2	\N
03442682-814c-4920-910c-ce3fa65b8df4	d54f5f83-aa63-4630-b9be-dbdca91b9315	daily_login	20	success	2025-09-10 03:55:50.583648+00	2025-09-10 03:55:50.583648+00	Daily login streak day 3	\N
7a786b68-7f36-4dda-b714-04b60e901e1a	d54f5f83-aa63-4630-b9be-dbdca91b9315	daily_login	25	success	2025-09-11 03:07:27.259628+00	2025-09-11 03:07:27.259628+00	Daily login streak day 4	\N
19d2f28e-333c-487c-98db-9c0bb4a3617a	0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf	daily_login	10	success	2025-09-11 08:25:45.732273+00	2025-09-11 08:25:45.732273+00	Daily login streak day 1	\N
af3d281d-beb1-41ba-b3cb-fbd044648457	d54f5f83-aa63-4630-b9be-dbdca91b9315	daily_login	30	success	2025-09-12 01:22:36.492297+00	2025-09-12 01:22:36.492297+00	Daily login streak day 5	\N
\.


--
-- Data for Name: user_answers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_answers (id, user_id, question_id, selected_option_id, answered_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_quiz_stats; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_quiz_stats (id, user_id, quiz_id, correct_answers, attempted_questions, completed_at) FROM stdin;
\.


--
-- Data for Name: messages_2025_09_08; Type: TABLE DATA; Schema: realtime; Owner: -
--

COPY realtime.messages_2025_09_08 (topic, extension, payload, event, private, updated_at, inserted_at, id) FROM stdin;
\.


--
-- Data for Name: messages_2025_09_09; Type: TABLE DATA; Schema: realtime; Owner: -
--

COPY realtime.messages_2025_09_09 (topic, extension, payload, event, private, updated_at, inserted_at, id) FROM stdin;
\.


--
-- Data for Name: messages_2025_09_10; Type: TABLE DATA; Schema: realtime; Owner: -
--

COPY realtime.messages_2025_09_10 (topic, extension, payload, event, private, updated_at, inserted_at, id) FROM stdin;
\.


--
-- Data for Name: messages_2025_09_11; Type: TABLE DATA; Schema: realtime; Owner: -
--

COPY realtime.messages_2025_09_11 (topic, extension, payload, event, private, updated_at, inserted_at, id) FROM stdin;
\.


--
-- Data for Name: messages_2025_09_12; Type: TABLE DATA; Schema: realtime; Owner: -
--

COPY realtime.messages_2025_09_12 (topic, extension, payload, event, private, updated_at, inserted_at, id) FROM stdin;
\.


--
-- Data for Name: messages_2025_09_13; Type: TABLE DATA; Schema: realtime; Owner: -
--

COPY realtime.messages_2025_09_13 (topic, extension, payload, event, private, updated_at, inserted_at, id) FROM stdin;
\.


--
-- Data for Name: messages_2025_09_14; Type: TABLE DATA; Schema: realtime; Owner: -
--

COPY realtime.messages_2025_09_14 (topic, extension, payload, event, private, updated_at, inserted_at, id) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: realtime; Owner: -
--

COPY realtime.schema_migrations (version, inserted_at) FROM stdin;
20211116024918	2025-07-30 07:48:05
20211116045059	2025-07-30 07:48:06
20211116050929	2025-07-30 07:48:06
20211116051442	2025-07-30 07:48:07
20211116212300	2025-07-30 07:48:08
20211116213355	2025-07-30 07:48:08
20211116213934	2025-07-30 07:48:09
20211116214523	2025-07-30 07:48:10
20211122062447	2025-07-30 07:48:10
20211124070109	2025-07-30 07:48:11
20211202204204	2025-07-30 07:48:12
20211202204605	2025-07-30 07:48:12
20211210212804	2025-07-30 07:48:14
20211228014915	2025-07-30 07:48:15
20220107221237	2025-07-30 07:48:15
20220228202821	2025-07-30 07:48:16
20220312004840	2025-07-30 07:48:17
20220603231003	2025-07-30 07:48:18
20220603232444	2025-07-30 07:48:18
20220615214548	2025-07-30 07:48:19
20220712093339	2025-07-30 07:48:20
20220908172859	2025-07-30 07:48:20
20220916233421	2025-07-30 07:48:21
20230119133233	2025-07-30 07:48:22
20230128025114	2025-07-30 07:48:22
20230128025212	2025-07-30 07:48:23
20230227211149	2025-07-30 07:48:24
20230228184745	2025-07-30 07:48:24
20230308225145	2025-07-30 07:48:25
20230328144023	2025-07-30 07:48:25
20231018144023	2025-07-30 07:48:26
20231204144023	2025-07-30 07:48:27
20231204144024	2025-07-30 07:48:28
20231204144025	2025-07-30 07:48:28
20240108234812	2025-07-30 07:48:29
20240109165339	2025-07-30 07:48:30
20240227174441	2025-07-30 07:48:31
20240311171622	2025-07-30 07:48:32
20240321100241	2025-07-30 07:48:33
20240401105812	2025-07-30 07:48:35
20240418121054	2025-07-30 07:48:36
20240523004032	2025-07-30 07:48:38
20240618124746	2025-07-30 07:48:38
20240801235015	2025-07-30 07:48:39
20240805133720	2025-07-30 07:48:40
20240827160934	2025-07-30 07:48:40
20240919163303	2025-07-30 07:48:41
20240919163305	2025-07-30 07:48:42
20241019105805	2025-07-30 07:48:42
20241030150047	2025-07-30 07:48:45
20241108114728	2025-07-30 07:48:46
20241121104152	2025-07-30 07:48:46
20241130184212	2025-07-30 07:48:47
20241220035512	2025-07-30 07:48:48
20241220123912	2025-07-30 07:48:48
20241224161212	2025-07-30 07:48:49
20250107150512	2025-07-30 07:48:49
20250110162412	2025-07-30 07:48:50
20250123174212	2025-07-30 07:48:51
20250128220012	2025-07-30 07:48:51
20250506224012	2025-07-30 07:48:52
20250523164012	2025-07-30 07:48:52
20250714121412	2025-07-30 07:48:53
\.


--
-- Data for Name: subscription; Type: TABLE DATA; Schema: realtime; Owner: -
--

COPY realtime.subscription (id, subscription_id, entity, filters, claims, created_at) FROM stdin;
\.


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.buckets (id, name, owner, created_at, updated_at, public, avif_autodetection, file_size_limit, allowed_mime_types, owner_id, type) FROM stdin;
avatars	avatars	\N	2025-08-25 19:42:10.011894+00	2025-08-25 19:42:10.011894+00	t	f	\N	\N	\N	STANDARD
\.


--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.buckets_analytics (id, type, format, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.migrations (id, name, hash, executed_at) FROM stdin;
0	create-migrations-table	e18db593bcde2aca2a408c4d1100f6abba2195df	2025-07-30 07:48:01.469087
1	initialmigration	6ab16121fbaa08bbd11b712d05f358f9b555d777	2025-07-30 07:48:01.488468
2	storage-schema	5c7968fd083fcea04050c1b7f6253c9771b99011	2025-07-30 07:48:01.512911
3	pathtoken-column	2cb1b0004b817b29d5b0a971af16bafeede4b70d	2025-07-30 07:48:01.563767
4	add-migrations-rls	427c5b63fe1c5937495d9c635c263ee7a5905058	2025-07-30 07:48:01.652163
5	add-size-functions	79e081a1455b63666c1294a440f8ad4b1e6a7f84	2025-07-30 07:48:01.656816
6	change-column-name-in-get-size	f93f62afdf6613ee5e7e815b30d02dc990201044	2025-07-30 07:48:01.661217
7	add-rls-to-buckets	e7e7f86adbc51049f341dfe8d30256c1abca17aa	2025-07-30 07:48:01.665591
8	add-public-to-buckets	fd670db39ed65f9d08b01db09d6202503ca2bab3	2025-07-30 07:48:01.668981
9	fix-search-function	3a0af29f42e35a4d101c259ed955b67e1bee6825	2025-07-30 07:48:01.672905
10	search-files-search-function	68dc14822daad0ffac3746a502234f486182ef6e	2025-07-30 07:48:01.680817
11	add-trigger-to-auto-update-updated_at-column	7425bdb14366d1739fa8a18c83100636d74dcaa2	2025-07-30 07:48:01.684847
12	add-automatic-avif-detection-flag	8e92e1266eb29518b6a4c5313ab8f29dd0d08df9	2025-07-30 07:48:01.693072
13	add-bucket-custom-limits	cce962054138135cd9a8c4bcd531598684b25e7d	2025-07-30 07:48:01.696642
14	use-bytes-for-max-size	941c41b346f9802b411f06f30e972ad4744dad27	2025-07-30 07:48:01.700837
15	add-can-insert-object-function	934146bc38ead475f4ef4b555c524ee5d66799e5	2025-07-30 07:48:01.737326
16	add-version	76debf38d3fd07dcfc747ca49096457d95b1221b	2025-07-30 07:48:01.810381
17	drop-owner-foreign-key	f1cbb288f1b7a4c1eb8c38504b80ae2a0153d101	2025-07-30 07:48:01.854491
18	add_owner_id_column_deprecate_owner	e7a511b379110b08e2f214be852c35414749fe66	2025-07-30 07:48:01.871418
19	alter-default-value-objects-id	02e5e22a78626187e00d173dc45f58fa66a4f043	2025-07-30 07:48:01.920521
20	list-objects-with-delimiter	cd694ae708e51ba82bf012bba00caf4f3b6393b7	2025-07-30 07:48:01.935523
21	s3-multipart-uploads	8c804d4a566c40cd1e4cc5b3725a664a9303657f	2025-07-30 07:48:01.945799
22	s3-multipart-uploads-big-ints	9737dc258d2397953c9953d9b86920b8be0cdb73	2025-07-30 07:48:01.966949
23	optimize-search-function	9d7e604cddc4b56a5422dc68c9313f4a1b6f132c	2025-07-30 07:48:01.978126
24	operation-function	8312e37c2bf9e76bbe841aa5fda889206d2bf8aa	2025-07-30 07:48:01.98188
25	custom-metadata	d974c6057c3db1c1f847afa0e291e6165693b990	2025-07-30 07:48:01.985484
26	objects-prefixes	ef3f7871121cdc47a65308e6702519e853422ae2	2025-08-26 17:04:43.068869
27	search-v2	33b8f2a7ae53105f028e13e9fcda9dc4f356b4a2	2025-08-26 17:04:43.677548
28	object-bucket-name-sorting	ba85ec41b62c6a30a3f136788227ee47f311c436	2025-08-26 17:04:43.864084
29	create-prefixes	a7b1a22c0dc3ab630e3055bfec7ce7d2045c5b7b	2025-08-26 17:04:43.971691
30	update-object-levels	6c6f6cc9430d570f26284a24cf7b210599032db7	2025-08-26 17:04:44.066581
31	objects-level-index	33f1fef7ec7fea08bb892222f4f0f5d79bab5eb8	2025-08-26 17:04:44.085568
32	backward-compatible-index-on-objects	2d51eeb437a96868b36fcdfb1ddefdf13bef1647	2025-08-26 17:04:45.166841
33	backward-compatible-index-on-prefixes	fe473390e1b8c407434c0e470655945b110507bf	2025-08-26 17:04:45.265447
34	optimize-search-function-v1	82b0e469a00e8ebce495e29bfa70a0797f7ebd2c	2025-08-26 17:04:45.271736
35	add-insert-trigger-prefixes	63bb9fd05deb3dc5e9fa66c83e82b152f0caf589	2025-08-26 17:04:45.37663
36	optimise-existing-functions	81cf92eb0c36612865a18016a38496c530443899	2025-08-26 17:04:45.38827
37	add-bucket-name-length-trigger	3944135b4e3e8b22d6d4cbb568fe3b0b51df15c1	2025-08-26 17:04:45.669034
38	iceberg-catalog-flag-on-buckets	19a8bd89d5dfa69af7f222a46c726b7c41e462c5	2025-08-26 17:04:45.871659
\.


--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata, version, owner_id, user_metadata, level) FROM stdin;
33656630-568c-4946-a40d-0613fa16f707	avatars	d54f5f83-aa63-4630-b9be-dbdca91b9315/1756152298453.jpg	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-08-25 20:05:00.522738+00	2025-08-26 17:04:43.978239+00	2025-08-25 20:05:00.522738+00	{"eTag": "\\"e4c127f0c186ae8c3276c5bd4c11470d\\"", "size": 2989958, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-08-25T20:05:01.000Z", "contentLength": 2989958, "httpStatusCode": 200}	422e9e3b-4291-4555-a600-0bc9184f7706	d54f5f83-aa63-4630-b9be-dbdca91b9315	{}	2
46fdfd9e-8219-47f1-836c-532247397e28	avatars	d54f5f83-aa63-4630-b9be-dbdca91b9315/1756152316624.jpg	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-08-25 20:05:16.281645+00	2025-08-26 17:04:43.978239+00	2025-08-25 20:05:16.281645+00	{"eTag": "\\"e0718ca269cf0dea82e384b80210369e\\"", "size": 532312, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-08-25T20:05:17.000Z", "contentLength": 532312, "httpStatusCode": 200}	e23fd8ea-77b6-43c6-9aa4-8834a9e5912f	d54f5f83-aa63-4630-b9be-dbdca91b9315	{}	2
a1f4bc2d-c55e-42b4-9b44-a830a74722a5	avatars	d54f5f83-aa63-4630-b9be-dbdca91b9315/1756185390240.jpg	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-08-26 05:16:33.355616+00	2025-08-26 17:04:43.978239+00	2025-08-26 05:16:33.355616+00	{"eTag": "\\"c1f510cf4a70227c534ad3d662bafcd4\\"", "size": 4163092, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-08-26T05:16:34.000Z", "contentLength": 4163092, "httpStatusCode": 200}	c8c16e6b-586e-4362-b1b6-563212a6d272	d54f5f83-aa63-4630-b9be-dbdca91b9315	{}	2
13b2328f-2149-4574-88a0-0f28289cc991	avatars	d54f5f83-aa63-4630-b9be-dbdca91b9315/1756281589410-WhatsApp Image 2025-05-01 at 01.09.57_bcf0ec48.jpg	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-08-27 07:59:48.565831+00	2025-08-27 07:59:48.565831+00	2025-08-27 07:59:48.565831+00	{"eTag": "\\"1617425f82858f337ceec611862c0bcb\\"", "size": 13440, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-08-27T07:59:49.000Z", "contentLength": 13440, "httpStatusCode": 200}	69d2044c-9c34-4ed4-85a6-8e9f4781e2d1	d54f5f83-aa63-4630-b9be-dbdca91b9315	{}	2
c907aa7c-66e6-47a1-bcba-b9b9f4c2cce4	avatars	d54f5f83-aa63-4630-b9be-dbdca91b9315/1756286374925-IMG_20250818_182332.jpg	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-08-27 09:19:38.101113+00	2025-08-27 09:19:38.101113+00	2025-08-27 09:19:38.101113+00	{"eTag": "\\"6a8d14a0dee3b868fa184edc3b06f436\\"", "size": 2948360, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-08-27T09:19:38.000Z", "contentLength": 2948360, "httpStatusCode": 200}	5570e585-620b-4c04-8b8d-5b73d1eae61b	d54f5f83-aa63-4630-b9be-dbdca91b9315	{}	2
308846ee-138b-4f31-9fda-4c8a77a51c7d	avatars	4f149df7-36b3-498d-8c9a-8663b6cc35ee/1756399633165-logo.png	4f149df7-36b3-498d-8c9a-8663b6cc35ee	2025-08-28 16:47:11.639916+00	2025-08-28 16:47:11.639916+00	2025-08-28 16:47:11.639916+00	{"eTag": "\\"dc44fc044ae7443932bc6eca8816cab3\\"", "size": 326323, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2025-08-28T16:47:12.000Z", "contentLength": 326323, "httpStatusCode": 200}	f877d3be-3838-49d6-8c91-5cfd4a55da38	4f149df7-36b3-498d-8c9a-8663b6cc35ee	{}	2
8517596d-c408-43ff-b7b7-849616a4b0d3	avatars	avatars/d54f5f83-aa63-4630-b9be-dbdca91b9315-1756574199832.png	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-08-30 17:16:40.004687+00	2025-08-30 17:16:40.004687+00	2025-08-30 17:16:40.004687+00	{"eTag": "\\"dc44fc044ae7443932bc6eca8816cab3\\"", "size": 326323, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2025-08-30T17:16:40.000Z", "contentLength": 326323, "httpStatusCode": 200}	35322123-1218-4e47-8918-b4e675be5e73	d54f5f83-aa63-4630-b9be-dbdca91b9315	{}	2
fd9fcc43-61e3-43ac-8f42-6a2633d58a59	avatars	avatars/d54f5f83-aa63-4630-b9be-dbdca91b9315-1756574212244.png	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-08-30 17:16:52.330999+00	2025-08-30 17:16:52.330999+00	2025-08-30 17:16:52.330999+00	{"eTag": "\\"dc44fc044ae7443932bc6eca8816cab3\\"", "size": 326323, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2025-08-30T17:16:53.000Z", "contentLength": 326323, "httpStatusCode": 200}	d02d2a03-e2d8-42c8-addb-37dbe00079a3	d54f5f83-aa63-4630-b9be-dbdca91b9315	{}	2
f032815f-2f17-4acd-8b12-d476c78b047b	avatars	avatars/d54f5f83-aa63-4630-b9be-dbdca91b9315-1756575851544.png	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-08-30 17:44:12.096313+00	2025-08-30 17:44:12.096313+00	2025-08-30 17:44:12.096313+00	{"eTag": "\\"dc44fc044ae7443932bc6eca8816cab3\\"", "size": 326323, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2025-08-30T17:44:12.000Z", "contentLength": 326323, "httpStatusCode": 200}	3b529408-6c5b-42fc-a082-77c0677b3bd8	d54f5f83-aa63-4630-b9be-dbdca91b9315	{}	2
4a910d12-e683-4bf6-b26e-1d8c6aa37452	avatars	avatars/d54f5f83-aa63-4630-b9be-dbdca91b9315-1756576459971.jpg	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-08-30 17:54:20.838508+00	2025-08-30 17:54:20.838508+00	2025-08-30 17:54:20.838508+00	{"eTag": "\\"616c55df2bcf754414743f8ad91f85f3\\"", "size": 506522, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-08-30T17:54:21.000Z", "contentLength": 506522, "httpStatusCode": 200}	0262e09d-53dc-425e-8a37-69682a991b04	d54f5f83-aa63-4630-b9be-dbdca91b9315	{}	2
f369ee85-c84f-4cb0-a24c-cad0dde7bc2c	avatars	d54f5f83-aa63-4630-b9be-dbdca91b9315/d54f5f83-aa63-4630-b9be-dbdca91b9315-1756576896765.jpg	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-08-30 18:01:36.997063+00	2025-08-30 18:01:36.997063+00	2025-08-30 18:01:36.997063+00	{"eTag": "\\"616c55df2bcf754414743f8ad91f85f3\\"", "size": 506522, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-08-30T18:01:37.000Z", "contentLength": 506522, "httpStatusCode": 200}	63bd25c2-1574-4aed-8d7f-76a10a8fc803	d54f5f83-aa63-4630-b9be-dbdca91b9315	{}	2
dd9e13ff-6fe5-4b4d-a1d2-74871b350dfc	avatars	d54f5f83-aa63-4630-b9be-dbdca91b9315/1756577551350.jpg	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-08-30 18:12:32.294867+00	2025-08-30 18:12:32.294867+00	2025-08-30 18:12:32.294867+00	{"eTag": "\\"616c55df2bcf754414743f8ad91f85f3\\"", "size": 506522, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-08-30T18:12:33.000Z", "contentLength": 506522, "httpStatusCode": 200}	ca707ca5-3741-42fb-9dee-0da5ea8a93ba	d54f5f83-aa63-4630-b9be-dbdca91b9315	{}	2
445adfae-3c7a-4df6-8b9a-6a04d825cd2b	avatars	0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf/1756577912545.jpg	0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf	2025-08-30 18:18:33.029614+00	2025-08-30 18:18:33.029614+00	2025-08-30 18:18:33.029614+00	{"eTag": "\\"616c55df2bcf754414743f8ad91f85f3\\"", "size": 506522, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-08-30T18:18:33.000Z", "contentLength": 506522, "httpStatusCode": 200}	02eb08f3-a189-4a88-9986-b3991e250b58	0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf	{}	2
184f1725-7549-4562-97d4-2876bcd622ab	avatars	d54f5f83-aa63-4630-b9be-dbdca91b9315/d54f5f83-aa63-4630-b9be-dbdca91b9315-1756742430855.jpg	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-09-01 16:00:31.49697+00	2025-09-01 16:00:31.49697+00	2025-09-01 16:00:31.49697+00	{"eTag": "\\"0be90630f08de45dde9f4265100751e7\\"", "size": 126324, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-01T16:00:32.000Z", "contentLength": 126324, "httpStatusCode": 200}	8dfd1865-0bf0-4095-8d7e-da1530991602	d54f5f83-aa63-4630-b9be-dbdca91b9315	{}	2
63962fcc-006f-45f2-9add-1b75d37aeed1	avatars	c9bac630-48da-42ef-b8ca-68797ed6d652/1756746475867.webp	c9bac630-48da-42ef-b8ca-68797ed6d652	2025-09-01 17:07:55.273036+00	2025-09-01 17:07:55.273036+00	2025-09-01 17:07:55.273036+00	{"eTag": "\\"b411374da4d8a0b9432368d72f38cd6d\\"", "size": 33842, "mimetype": "image/webp", "cacheControl": "max-age=3600", "lastModified": "2025-09-01T17:07:56.000Z", "contentLength": 33842, "httpStatusCode": 200}	512a9431-ff03-4859-a703-729c479b86dc	c9bac630-48da-42ef-b8ca-68797ed6d652	{}	2
\.


--
-- Data for Name: prefixes; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.prefixes (bucket_id, name, created_at, updated_at) FROM stdin;
avatars	d54f5f83-aa63-4630-b9be-dbdca91b9315	2025-08-26 17:04:43.866988+00	2025-08-26 17:04:43.866988+00
avatars	4f149df7-36b3-498d-8c9a-8663b6cc35ee	2025-08-28 16:47:11.639916+00	2025-08-28 16:47:11.639916+00
avatars	avatars	2025-08-30 17:16:40.004687+00	2025-08-30 17:16:40.004687+00
avatars	0ba6d7cb-d163-4c8d-81fd-ab37c051d5cf	2025-08-30 18:18:33.029614+00	2025-08-30 18:18:33.029614+00
avatars	c9bac630-48da-42ef-b8ca-68797ed6d652	2025-09-01 17:07:55.273036+00	2025-09-01 17:07:55.273036+00
\.


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.s3_multipart_uploads (id, in_progress_size, upload_signature, bucket_id, key, version, owner_id, created_at, user_metadata) FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.s3_multipart_uploads_parts (id, upload_id, size, part_number, bucket_id, key, etag, owner_id, version, created_at) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: supabase_migrations; Owner: -
--

COPY supabase_migrations.schema_migrations (version, statements, name) FROM stdin;
\.


--
-- Data for Name: seed_files; Type: TABLE DATA; Schema: supabase_migrations; Owner: -
--

COPY supabase_migrations.seed_files (path, hash) FROM stdin;
\.


--
-- Data for Name: secrets; Type: TABLE DATA; Schema: vault; Owner: -
--

COPY vault.secrets (id, name, description, secret, key_id, nonce, created_at, updated_at) FROM stdin;
\.


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: -
--

SELECT pg_catalog.setval('auth.refresh_tokens_id_seq', 388, true);


--
-- Name: jobid_seq; Type: SEQUENCE SET; Schema: cron; Owner: -
--

SELECT pg_catalog.setval('cron.jobid_seq', 12, true);


--
-- Name: runid_seq; Type: SEQUENCE SET; Schema: cron; Owner: -
--

SELECT pg_catalog.setval('cron.runid_seq', 2060, true);


--
-- Name: levels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.levels_id_seq', 4, true);


--
-- Name: subscription_id_seq; Type: SEQUENCE SET; Schema: realtime; Owner: -
--

SELECT pg_catalog.setval('realtime.subscription_id_seq', 1149, true);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_client_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_client_id_key UNIQUE (client_id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: daily_streaks daily_streaks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_streaks
    ADD CONSTRAINT daily_streaks_pkey PRIMARY KEY (id);


--
-- Name: daily_streaks daily_streaks_user_id_login_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_streaks
    ADD CONSTRAINT daily_streaks_user_id_login_date_key UNIQUE (user_id, login_date);


--
-- Name: levels levels_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.levels
    ADD CONSTRAINT levels_name_key UNIQUE (name);


--
-- Name: levels levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.levels
    ADD CONSTRAINT levels_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: options options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.options
    ADD CONSTRAINT options_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: quiz_participants quiz_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_participants
    ADD CONSTRAINT quiz_participants_pkey PRIMARY KEY (id);


--
-- Name: quiz_participants quiz_participants_quiz_user_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_participants
    ADD CONSTRAINT quiz_participants_quiz_user_key UNIQUE (quiz_id, user_id);


--
-- Name: quiz_prizes quiz_prizes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_prizes
    ADD CONSTRAINT quiz_prizes_pkey PRIMARY KEY (id);


--
-- Name: quiz_results quiz_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_results
    ADD CONSTRAINT quiz_results_pkey PRIMARY KEY (id);


--
-- Name: quiz_results quiz_results_quiz_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_results
    ADD CONSTRAINT quiz_results_quiz_id_key UNIQUE (quiz_id);


--
-- Name: quizzes quizzes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_pkey PRIMARY KEY (id);


--
-- Name: redemptions redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redemptions
    ADD CONSTRAINT redemptions_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_referrer_id_referred_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referrer_id_referred_id_key UNIQUE (referrer_id, referred_id);


--
-- Name: reward_catalog reward_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_catalog
    ADD CONSTRAINT reward_catalog_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: user_answers user_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_answers
    ADD CONSTRAINT user_answers_pkey PRIMARY KEY (id);


--
-- Name: user_answers user_answers_user_question_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_answers
    ADD CONSTRAINT user_answers_user_question_key UNIQUE (user_id, question_id);


--
-- Name: user_quiz_stats user_quiz_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_quiz_stats
    ADD CONSTRAINT user_quiz_stats_pkey PRIMARY KEY (id);


--
-- Name: user_quiz_stats user_quiz_stats_user_id_quiz_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_quiz_stats
    ADD CONSTRAINT user_quiz_stats_user_id_quiz_id_key UNIQUE (user_id, quiz_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2025_09_08 messages_2025_09_08_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2025_09_08
    ADD CONSTRAINT messages_2025_09_08_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2025_09_09 messages_2025_09_09_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2025_09_09
    ADD CONSTRAINT messages_2025_09_09_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2025_09_10 messages_2025_09_10_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2025_09_10
    ADD CONSTRAINT messages_2025_09_10_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2025_09_11 messages_2025_09_11_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2025_09_11
    ADD CONSTRAINT messages_2025_09_11_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2025_09_12 messages_2025_09_12_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2025_09_12
    ADD CONSTRAINT messages_2025_09_12_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2025_09_13 messages_2025_09_13_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2025_09_13
    ADD CONSTRAINT messages_2025_09_13_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2025_09_14 messages_2025_09_14_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2025_09_14
    ADD CONSTRAINT messages_2025_09_14_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: prefixes prefixes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT prefixes_pkey PRIMARY KEY (bucket_id, level, name);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: seed_files seed_files_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.seed_files
    ADD CONSTRAINT seed_files_pkey PRIMARY KEY (path);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_clients_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_client_id_idx ON auth.oauth_clients USING btree (client_id);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: idx_daily_streaks_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_streaks_user_date ON public.daily_streaks USING btree (user_id, login_date);


--
-- Name: idx_notifications_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created_by ON public.notifications USING btree (created_by);


--
-- Name: idx_notifications_quiz_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_quiz_id ON public.notifications USING btree (quiz_id);


--
-- Name: idx_options_question_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_options_question_id ON public.options USING btree (question_id);


--
-- Name: idx_profiles_referred_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_referred_by ON public.profiles USING btree (referred_by);


--
-- Name: idx_questions_quiz_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_quiz_id ON public.questions USING btree (quiz_id);


--
-- Name: idx_quiz_participants_quiz; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_participants_quiz ON public.quiz_participants USING btree (quiz_id);


--
-- Name: idx_quiz_participants_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_participants_user ON public.quiz_participants USING btree (user_id);


--
-- Name: idx_quiz_prizes_quiz_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_prizes_quiz_id ON public.quiz_prizes USING btree (quiz_id);


--
-- Name: idx_quiz_results_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_results_user_id ON public.quiz_results USING btree (user_id);


--
-- Name: idx_quizzes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quizzes_status ON public.quizzes USING btree (status);


--
-- Name: idx_redemptions_catalog_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redemptions_catalog_id ON public.redemptions USING btree (catalog_id);


--
-- Name: idx_redemptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redemptions_user_id ON public.redemptions USING btree (user_id);


--
-- Name: idx_referrals_referred_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_referred_id ON public.referrals USING btree (referred_id);


--
-- Name: idx_referrals_referrer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_referrer_id ON public.referrals USING btree (referrer_id);


--
-- Name: idx_transactions_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_user_created ON public.transactions USING btree (user_id, created_at DESC);


--
-- Name: idx_tx_user_type_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tx_user_type_date ON public.transactions USING btree (user_id, type, created_at);


--
-- Name: idx_user_answers_question; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_answers_question ON public.user_answers USING btree (question_id);


--
-- Name: idx_user_answers_selected_option_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_answers_selected_option_id ON public.user_answers USING btree (selected_option_id);


--
-- Name: idx_user_answers_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_answers_user ON public.user_answers USING btree (user_id);


--
-- Name: idx_user_quiz_stats_user_id_completed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_quiz_stats_user_id_completed_at ON public.user_quiz_stats USING btree (user_id, completed_at);


--
-- Name: ix_push_subscriptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_push_subscriptions_user_id ON public.push_subscriptions USING btree (user_id);


--
-- Name: ix_user_quiz_stats_quiz_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_quiz_stats_quiz_id ON public.user_quiz_stats USING btree (quiz_id);


--
-- Name: push_subscriptions_endpoint_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX push_subscriptions_endpoint_idx ON public.push_subscriptions USING btree (((subscription_object ->> 'endpoint'::text)));


--
-- Name: ux_tx_daily_login_once_per_day; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_tx_daily_login_once_per_day ON public.transactions USING btree (user_id, (((created_at AT TIME ZONE 'UTC'::text))::date)) WHERE (type = 'daily_login'::text);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: subscription_subscription_id_entity_filters_key; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_key ON realtime.subscription USING btree (subscription_id, entity, filters);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_name_bucket_level_unique; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_name_bucket_level_unique ON storage.objects USING btree (name COLLATE "C", bucket_id, level);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_lower_name ON storage.objects USING btree ((path_tokens[level]), lower(name) text_pattern_ops, bucket_id, level);


--
-- Name: idx_prefixes_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_prefixes_lower_name ON storage.prefixes USING btree (bucket_id, level, ((string_to_array(name, '/'::text))[level]), lower(name) text_pattern_ops);


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: objects_bucket_id_level_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX objects_bucket_id_level_idx ON storage.objects USING btree (bucket_id, level, name COLLATE "C");


--
-- Name: messages_2025_09_08_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2025_09_08_pkey;


--
-- Name: messages_2025_09_09_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2025_09_09_pkey;


--
-- Name: messages_2025_09_10_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2025_09_10_pkey;


--
-- Name: messages_2025_09_11_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2025_09_11_pkey;


--
-- Name: messages_2025_09_12_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2025_09_12_pkey;


--
-- Name: messages_2025_09_13_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2025_09_13_pkey;


--
-- Name: messages_2025_09_14_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2025_09_14_pkey;


--
-- Name: profiles on_profile_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_profile_change AFTER INSERT OR UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_user_claims();


--
-- Name: daily_streaks trg_after_daily_streak_credit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_after_daily_streak_credit AFTER INSERT ON public.daily_streaks FOR EACH ROW EXECUTE FUNCTION public.after_daily_streak_credit();


--
-- Name: quiz_results trg_after_quiz_result; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_after_quiz_result AFTER INSERT ON public.quiz_results FOR EACH ROW EXECUTE FUNCTION public.after_quiz_result_check();


--
-- Name: referrals trg_after_referral; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_after_referral AFTER INSERT ON public.referrals FOR EACH ROW EXECUTE FUNCTION public.after_referral_check();


--
-- Name: profiles trg_assign_level; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_assign_level AFTER UPDATE OF total_coins ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.assign_level();


--
-- Name: options trg_options_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_options_updated BEFORE UPDATE ON public.options FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles trg_profiles_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: questions trg_questions_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_questions_updated BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: quizzes trg_quiz_notifications; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quiz_notifications AFTER UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.trg_quiz_notifications();


--
-- Name: quiz_participants trg_quiz_participants_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quiz_participants_updated BEFORE UPDATE ON public.quiz_participants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: quiz_prizes trg_quiz_prizes_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quiz_prizes_updated BEFORE UPDATE ON public.quiz_prizes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: quiz_results trg_quiz_results_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quiz_results_updated BEFORE UPDATE ON public.quiz_results FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: quizzes trg_quizzes_finish_compute; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quizzes_finish_compute AFTER UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.trg_quiz_finished_compute();


--
-- Name: quizzes trg_quizzes_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quizzes_updated BEFORE UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles trg_reward_referral; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reward_referral AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.reward_referral();


--
-- Name: transactions trg_transactions_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_transactions_updated BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: transactions trg_tx_sync_profiles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tx_sync_profiles AFTER INSERT OR DELETE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.trg_tx_sync_profiles();


--
-- Name: user_answers trg_user_answers_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_answers_updated BEFORE UPDATE ON public.user_answers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles trigger_generate_referral_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_generate_referral_code BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.generate_referral_code();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: objects objects_delete_delete_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects objects_insert_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();


--
-- Name: objects objects_update_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();


--
-- Name: prefixes prefixes_create_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();


--
-- Name: prefixes prefixes_delete_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: daily_streaks daily_streaks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_streaks
    ADD CONSTRAINT daily_streaks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: options fk_options_question; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.options
    ADD CONSTRAINT fk_options_question FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;


--
-- Name: questions fk_questions_quiz; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT fk_questions_quiz FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;


--
-- Name: quiz_participants fk_quiz_participants_quiz; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_participants
    ADD CONSTRAINT fk_quiz_participants_quiz FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;


--
-- Name: quiz_participants fk_quiz_participants_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_participants
    ADD CONSTRAINT fk_quiz_participants_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: quiz_prizes fk_quiz_prizes_quiz; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_prizes
    ADD CONSTRAINT fk_quiz_prizes_quiz FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;


--
-- Name: quiz_results fk_quiz_results_quiz; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_results
    ADD CONSTRAINT fk_quiz_results_quiz FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;


--
-- Name: quiz_results fk_quiz_results_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_results
    ADD CONSTRAINT fk_quiz_results_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: transactions fk_transactions_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_answers fk_user_answers_option; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_answers
    ADD CONSTRAINT fk_user_answers_option FOREIGN KEY (selected_option_id) REFERENCES public.options(id) ON DELETE CASCADE;


--
-- Name: user_answers fk_user_answers_question; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_answers
    ADD CONSTRAINT fk_user_answers_question FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;


--
-- Name: user_answers fk_user_answers_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_answers
    ADD CONSTRAINT fk_user_answers_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_referred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.profiles(id);


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: quiz_participants quiz_participants_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_participants
    ADD CONSTRAINT quiz_participants_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id);


--
-- Name: quiz_prizes quiz_prizes_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_prizes
    ADD CONSTRAINT quiz_prizes_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;


--
-- Name: quiz_results quiz_results_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_results
    ADD CONSTRAINT quiz_results_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;


--
-- Name: redemptions redemptions_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redemptions
    ADD CONSTRAINT redemptions_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES public.reward_catalog(id);


--
-- Name: redemptions redemptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redemptions
    ADD CONSTRAINT redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: referrals referrals_referred_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referred_id_fkey FOREIGN KEY (referred_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: referrals referrals_referrer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_quiz_stats user_quiz_stats_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_quiz_stats
    ADD CONSTRAINT user_quiz_stats_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;


--
-- Name: user_quiz_stats user_quiz_stats_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_quiz_stats
    ADD CONSTRAINT user_quiz_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: prefixes prefixes_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT "prefixes_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_streaks Daily streaks are viewable by authenticated users.; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Daily streaks are viewable by authenticated users." ON public.daily_streaks FOR SELECT TO authenticated USING (true);


--
-- Name: notifications Notifications access policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Notifications access policy" ON public.notifications TO authenticated USING (true) WITH CHECK (((public.get_my_claim('is_admin'::text))::boolean IS TRUE));


--
-- Name: options Options access policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Options access policy" ON public.options TO authenticated USING ((((public.get_my_claim('is_admin'::text))::boolean IS TRUE) OR (EXISTS ( SELECT 1
   FROM (public.questions q
     JOIN public.quiz_participants qp ON ((q.quiz_id = qp.quiz_id)))
  WHERE ((q.id = options.question_id) AND (qp.user_id = ( SELECT auth.uid() AS uid))))))) WITH CHECK (((public.get_my_claim('is_admin'::text))::boolean IS TRUE));


--
-- Name: quiz_participants Participants access for owners and admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants access for owners and admins" ON public.quiz_participants TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR ((public.get_my_claim('is_admin'::text))::boolean IS TRUE))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR ((public.get_my_claim('is_admin'::text))::boolean IS TRUE)));


--
-- Name: profiles Profiles are viewable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: questions Questions access policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Questions access policy" ON public.questions TO authenticated USING ((((public.get_my_claim('is_admin'::text))::boolean IS TRUE) OR public.is_quiz_member(quiz_id))) WITH CHECK (((public.get_my_claim('is_admin'::text))::boolean IS TRUE));


--
-- Name: quiz_prizes Quiz prizes: service_role manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Quiz prizes: service_role manage" ON public.quiz_prizes USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));


--
-- Name: quizzes Quizzes access policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Quizzes access policy" ON public.quizzes TO authenticated USING (true) WITH CHECK (((public.get_my_claim('is_admin'::text))::boolean IS TRUE));


--
-- Name: redemptions Redemptions access for owners and admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Redemptions access for owners and admins" ON public.redemptions TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR ((public.get_my_claim('is_admin'::text))::boolean IS TRUE))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR ((public.get_my_claim('is_admin'::text))::boolean IS TRUE)));


--
-- Name: quiz_results Results access policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Results access policy" ON public.quiz_results TO authenticated USING ((((public.get_my_claim('is_admin'::text))::boolean IS TRUE) OR public.is_quiz_member(quiz_id))) WITH CHECK (((public.get_my_claim('is_admin'::text))::boolean IS TRUE));


--
-- Name: reward_catalog Reward catalog access policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reward catalog access policy" ON public.reward_catalog TO authenticated USING (true) WITH CHECK (((public.get_my_claim('is_admin'::text))::boolean IS TRUE));


--
-- Name: user_quiz_stats Stats access for owners and admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Stats access for owners and admins" ON public.user_quiz_stats TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR ((public.get_my_claim('is_admin'::text))::boolean IS TRUE))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR ((public.get_my_claim('is_admin'::text))::boolean IS TRUE)));


--
-- Name: user_answers User answers: insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "User answers: insert own" ON public.user_answers FOR INSERT WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: user_answers User answers: select own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "User answers: select own" ON public.user_answers FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: user_answers User answers: update own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "User answers: update own" ON public.user_answers FOR UPDATE USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: referrals Users can insert referrals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert referrals" ON public.referrals FOR INSERT WITH CHECK (((( SELECT auth.uid() AS uid) = referrer_id) OR (( SELECT auth.uid() AS uid) = referred_id)));


--
-- Name: push_subscriptions Users can manage their own push subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own push subscriptions" ON public.push_subscriptions TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = id)) WITH CHECK ((( SELECT auth.uid() AS uid) = id));


--
-- Name: referrals Users can view own referrals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own referrals" ON public.referrals FOR SELECT USING (((( SELECT auth.uid() AS uid) = referrer_id) OR (( SELECT auth.uid() AS uid) = referred_id)));


--
-- Name: daily_streaks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_streaks ENABLE ROW LEVEL SECURITY;

--
-- Name: levels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;

--
-- Name: levels levels_read_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY levels_read_auth ON public.levels FOR SELECT TO authenticated USING (true);


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: options; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = id));


--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

--
-- Name: quiz_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quiz_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: quiz_prizes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quiz_prizes ENABLE ROW LEVEL SECURITY;

--
-- Name: quiz_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;

--
-- Name: quizzes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

--
-- Name: redemptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

--
-- Name: referrals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

--
-- Name: reward_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reward_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_streaks streaks_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY streaks_insert_own ON public.daily_streaks FOR INSERT WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions transactions_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transactions_select_own ON public.transactions FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_answers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_answers ENABLE ROW LEVEL SECURITY;

--
-- Name: user_quiz_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_quiz_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: objects Authenticated users can upload avatars; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'avatars'::text));


--
-- Name: objects Avatar images are publicly accessible; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING ((bucket_id = 'avatars'::text));


--
-- Name: objects Avatars: public read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Avatars: public read" ON storage.objects FOR SELECT USING ((bucket_id = 'avatars'::text));


--
-- Name: objects Avatars: user can manage own files; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Avatars: user can manage own files" ON storage.objects USING (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = split_part(name, '/'::text, 1)))) WITH CHECK (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = split_part(name, '/'::text, 1))));


--
-- Name: objects Public read avatars; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING ((bucket_id = 'avatars'::text));


--
-- Name: objects Users can delete own avatars; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can delete own avatars" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'avatars'::text) AND (owner = auth.uid())));


--
-- Name: objects Users can delete their own avatar; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can delete their own avatar" ON storage.objects FOR DELETE USING (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));


--
-- Name: objects Users can update own avatars; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can update own avatars" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'avatars'::text) AND (owner = auth.uid()))) WITH CHECK (((bucket_id = 'avatars'::text) AND (owner = auth.uid())));


--
-- Name: objects Users can update their own avatar; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE USING (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));


--
-- Name: objects Users can upload their own avatar; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));


--
-- Name: objects avatars_auth_delete_own; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY avatars_auth_delete_own ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'avatars'::text) AND (owner = auth.uid())));


--
-- Name: objects avatars_auth_insert; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY avatars_auth_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'avatars'::text) AND (owner = auth.uid())));


--
-- Name: objects avatars_auth_update_own; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY avatars_auth_update_own ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'avatars'::text) AND (owner = auth.uid()))) WITH CHECK (((bucket_id = 'avatars'::text) AND (owner = auth.uid())));


--
-- Name: objects avatars_public_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY avatars_public_read ON storage.objects FOR SELECT USING ((bucket_id = 'avatars'::text));


--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: prefixes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.prefixes ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime_messages_publication; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime_messages_publication WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime quiz_participants; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.quiz_participants;


--
-- Name: supabase_realtime quiz_results; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.quiz_results;


--
-- Name: supabase_realtime quizzes; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.quizzes;


--
-- Name: supabase_realtime_messages_publication messages; Type: PUBLICATION TABLE; Schema: realtime; Owner: -
--

ALTER PUBLICATION supabase_realtime_messages_publication ADD TABLE ONLY realtime.messages;


--
-- Name: SCHEMA auth; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO dashboard_user;
GRANT USAGE ON SCHEMA auth TO postgres;


--
-- Name: SCHEMA cron; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA cron TO postgres WITH GRANT OPTION;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: SCHEMA realtime; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA realtime TO postgres;
GRANT USAGE ON SCHEMA realtime TO anon;
GRANT USAGE ON SCHEMA realtime TO authenticated;
GRANT USAGE ON SCHEMA realtime TO service_role;
GRANT ALL ON SCHEMA realtime TO supabase_realtime_admin;


--
-- Name: SCHEMA storage; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA storage TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA storage TO anon;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO service_role;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
GRANT ALL ON SCHEMA storage TO dashboard_user;


--
-- Name: SCHEMA vault; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA vault TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA vault TO service_role;


--
-- Name: FUNCTION email(); Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON FUNCTION auth.email() TO dashboard_user;


--
-- Name: FUNCTION jwt(); Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON FUNCTION auth.jwt() TO postgres;
GRANT ALL ON FUNCTION auth.jwt() TO dashboard_user;


--
-- Name: FUNCTION role(); Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON FUNCTION auth.role() TO dashboard_user;


--
-- Name: FUNCTION uid(); Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON FUNCTION auth.uid() TO dashboard_user;


--
-- Name: FUNCTION alter_job(job_id bigint, schedule text, command text, database text, username text, active boolean); Type: ACL; Schema: cron; Owner: -
--

GRANT ALL ON FUNCTION cron.alter_job(job_id bigint, schedule text, command text, database text, username text, active boolean) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION job_cache_invalidate(); Type: ACL; Schema: cron; Owner: -
--

GRANT ALL ON FUNCTION cron.job_cache_invalidate() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION schedule(schedule text, command text); Type: ACL; Schema: cron; Owner: -
--

GRANT ALL ON FUNCTION cron.schedule(schedule text, command text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION schedule(job_name text, schedule text, command text); Type: ACL; Schema: cron; Owner: -
--

GRANT ALL ON FUNCTION cron.schedule(job_name text, schedule text, command text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION schedule_in_database(job_name text, schedule text, command text, database text, username text, active boolean); Type: ACL; Schema: cron; Owner: -
--

GRANT ALL ON FUNCTION cron.schedule_in_database(job_name text, schedule text, command text, database text, username text, active boolean) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION unschedule(job_id bigint); Type: ACL; Schema: cron; Owner: -
--

GRANT ALL ON FUNCTION cron.unschedule(job_id bigint) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION unschedule(job_name text); Type: ACL; Schema: cron; Owner: -
--

GRANT ALL ON FUNCTION cron.unschedule(job_name text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION graphql("operationName" text, query text, variables jsonb, extensions jsonb); Type: ACL; Schema: graphql_public; Owner: -
--

GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO postgres;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO anon;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO authenticated;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO service_role;


--
-- Name: FUNCTION get_auth(p_usename text); Type: ACL; Schema: pgbouncer; Owner: -
--

REVOKE ALL ON FUNCTION pgbouncer.get_auth(p_usename text) FROM PUBLIC;
GRANT ALL ON FUNCTION pgbouncer.get_auth(p_usename text) TO pgbouncer;
GRANT ALL ON FUNCTION pgbouncer.get_auth(p_usename text) TO postgres;


--
-- Name: FUNCTION _tx_is_credit(t text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._tx_is_credit(t text) TO anon;
GRANT ALL ON FUNCTION public._tx_is_credit(t text) TO authenticated;
GRANT ALL ON FUNCTION public._tx_is_credit(t text) TO service_role;


--
-- Name: FUNCTION add_credit(p_user_id uuid, p_type text, p_amount integer, p_desc text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_credit(p_user_id uuid, p_type text, p_amount integer, p_desc text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_credit(p_user_id uuid, p_type text, p_amount integer, p_desc text) TO anon;
GRANT ALL ON FUNCTION public.add_credit(p_user_id uuid, p_type text, p_amount integer, p_desc text) TO authenticated;
GRANT ALL ON FUNCTION public.add_credit(p_user_id uuid, p_type text, p_amount integer, p_desc text) TO service_role;


--
-- Name: FUNCTION after_daily_streak_credit(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.after_daily_streak_credit() TO anon;
GRANT ALL ON FUNCTION public.after_daily_streak_credit() TO authenticated;
GRANT ALL ON FUNCTION public.after_daily_streak_credit() TO service_role;


--
-- Name: FUNCTION after_quiz_result_check(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.after_quiz_result_check() TO anon;
GRANT ALL ON FUNCTION public.after_quiz_result_check() TO authenticated;
GRANT ALL ON FUNCTION public.after_quiz_result_check() TO service_role;


--
-- Name: FUNCTION after_referral_check(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.after_referral_check() TO anon;
GRANT ALL ON FUNCTION public.after_referral_check() TO authenticated;
GRANT ALL ON FUNCTION public.after_referral_check() TO service_role;


--
-- Name: FUNCTION approve_latest_redemption(p_email text, p_reward_value text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.approve_latest_redemption(p_email text, p_reward_value text) TO anon;
GRANT ALL ON FUNCTION public.approve_latest_redemption(p_email text, p_reward_value text) TO authenticated;
GRANT ALL ON FUNCTION public.approve_latest_redemption(p_email text, p_reward_value text) TO service_role;


--
-- Name: FUNCTION approve_redemption(p_redemption_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.approve_redemption(p_redemption_id uuid) TO anon;
GRANT ALL ON FUNCTION public.approve_redemption(p_redemption_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.approve_redemption(p_redemption_id uuid) TO service_role;


--
-- Name: FUNCTION assign_level(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.assign_level() TO anon;
GRANT ALL ON FUNCTION public.assign_level() TO authenticated;
GRANT ALL ON FUNCTION public.assign_level() TO service_role;


--
-- Name: FUNCTION compute_quiz_results(p_quiz_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.compute_quiz_results(p_quiz_id uuid) TO anon;
GRANT ALL ON FUNCTION public.compute_quiz_results(p_quiz_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.compute_quiz_results(p_quiz_id uuid) TO service_role;


--
-- Name: FUNCTION create_notification(p_title text, p_message text, p_type text, p_quiz_id uuid, p_scheduled_at timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_notification(p_title text, p_message text, p_type text, p_quiz_id uuid, p_scheduled_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_notification(p_title text, p_message text, p_type text, p_quiz_id uuid, p_scheduled_at timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.create_notification(p_title text, p_message text, p_type text, p_quiz_id uuid, p_scheduled_at timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.create_notification(p_title text, p_message text, p_type text, p_quiz_id uuid, p_scheduled_at timestamp with time zone) TO service_role;


--
-- Name: FUNCTION delete_push_subscription(p_endpoint text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_push_subscription(p_endpoint text) TO anon;
GRANT ALL ON FUNCTION public.delete_push_subscription(p_endpoint text) TO authenticated;
GRANT ALL ON FUNCTION public.delete_push_subscription(p_endpoint text) TO service_role;


--
-- Name: FUNCTION generate_referral_code(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_referral_code() TO anon;
GRANT ALL ON FUNCTION public.generate_referral_code() TO authenticated;
GRANT ALL ON FUNCTION public.generate_referral_code() TO service_role;


--
-- Name: FUNCTION get_all_time_leaderboard(limit_rows integer, offset_rows integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_all_time_leaderboard(limit_rows integer, offset_rows integer) TO anon;
GRANT ALL ON FUNCTION public.get_all_time_leaderboard(limit_rows integer, offset_rows integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_all_time_leaderboard(limit_rows integer, offset_rows integer) TO service_role;


--
-- Name: FUNCTION get_leaderboard(p_period text, limit_rows integer, offset_rows integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_leaderboard(p_period text, limit_rows integer, offset_rows integer) TO anon;
GRANT ALL ON FUNCTION public.get_leaderboard(p_period text, limit_rows integer, offset_rows integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_leaderboard(p_period text, limit_rows integer, offset_rows integer) TO service_role;


--
-- Name: FUNCTION get_my_claim(claim text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_my_claim(claim text) TO anon;
GRANT ALL ON FUNCTION public.get_my_claim(claim text) TO authenticated;
GRANT ALL ON FUNCTION public.get_my_claim(claim text) TO service_role;


--
-- Name: FUNCTION get_participant_count(p_quiz_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_participant_count(p_quiz_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_participant_count(p_quiz_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_participant_count(p_quiz_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_participant_count(p_quiz_id uuid) TO service_role;


--
-- Name: FUNCTION handle_daily_login(user_uuid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_daily_login(user_uuid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_daily_login(user_uuid uuid) TO anon;
GRANT ALL ON FUNCTION public.handle_daily_login(user_uuid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.handle_daily_login(user_uuid uuid) TO service_role;


--
-- Name: FUNCTION handle_referral_bonus(referred_user_uuid uuid, referrer_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_referral_bonus(referred_user_uuid uuid, referrer_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_referral_bonus(referred_user_uuid uuid, referrer_code text) TO anon;
GRANT ALL ON FUNCTION public.handle_referral_bonus(referred_user_uuid uuid, referrer_code text) TO authenticated;
GRANT ALL ON FUNCTION public.handle_referral_bonus(referred_user_uuid uuid, referrer_code text) TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_admin() TO anon;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION is_own_profile(p_profile_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_own_profile(p_profile_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_own_profile(p_profile_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_own_profile(p_profile_id uuid) TO service_role;


--
-- Name: FUNCTION is_quiz_member(p_quiz_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_quiz_member(p_quiz_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_quiz_member(p_quiz_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_quiz_member(p_quiz_id uuid) TO service_role;


--
-- Name: FUNCTION join_quiz(p_quiz_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.join_quiz(p_quiz_id uuid) TO anon;
GRANT ALL ON FUNCTION public.join_quiz(p_quiz_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.join_quiz(p_quiz_id uuid) TO service_role;


--
-- Name: FUNCTION join_quiz(p_user_id uuid, p_quiz_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.join_quiz(p_user_id uuid, p_quiz_id uuid) TO anon;
GRANT ALL ON FUNCTION public.join_quiz(p_user_id uuid, p_quiz_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.join_quiz(p_user_id uuid, p_quiz_id uuid) TO service_role;


--
-- Name: FUNCTION jwt_claim(claim text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.jwt_claim(claim text) TO anon;
GRANT ALL ON FUNCTION public.jwt_claim(claim text) TO authenticated;
GRANT ALL ON FUNCTION public.jwt_claim(claim text) TO service_role;


--
-- Name: FUNCTION process_pending_quizzes(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.process_pending_quizzes() TO anon;
GRANT ALL ON FUNCTION public.process_pending_quizzes() TO authenticated;
GRANT ALL ON FUNCTION public.process_pending_quizzes() TO service_role;


--
-- Name: FUNCTION redeem_from_catalog(p_user_id uuid, p_catalog_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.redeem_from_catalog(p_user_id uuid, p_catalog_id uuid) TO anon;
GRANT ALL ON FUNCTION public.redeem_from_catalog(p_user_id uuid, p_catalog_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.redeem_from_catalog(p_user_id uuid, p_catalog_id uuid) TO service_role;


--
-- Name: FUNCTION redeem_reward(p_user_id uuid, p_reward_type text, p_reward_value text, p_coins_required integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.redeem_reward(p_user_id uuid, p_reward_type text, p_reward_value text, p_coins_required integer) TO anon;
GRANT ALL ON FUNCTION public.redeem_reward(p_user_id uuid, p_reward_type text, p_reward_value text, p_coins_required integer) TO authenticated;
GRANT ALL ON FUNCTION public.redeem_reward(p_user_id uuid, p_reward_type text, p_reward_value text, p_coins_required integer) TO service_role;


--
-- Name: FUNCTION reject_latest_redemption(p_email text, p_reward_value text, p_reason text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reject_latest_redemption(p_email text, p_reward_value text, p_reason text) TO anon;
GRANT ALL ON FUNCTION public.reject_latest_redemption(p_email text, p_reward_value text, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.reject_latest_redemption(p_email text, p_reward_value text, p_reason text) TO service_role;


--
-- Name: FUNCTION reject_redemption(p_redemption_id uuid, p_reason text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reject_redemption(p_redemption_id uuid, p_reason text) TO anon;
GRANT ALL ON FUNCTION public.reject_redemption(p_redemption_id uuid, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.reject_redemption(p_redemption_id uuid, p_reason text) TO service_role;


--
-- Name: FUNCTION reward_referral(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reward_referral() TO anon;
GRANT ALL ON FUNCTION public.reward_referral() TO authenticated;
GRANT ALL ON FUNCTION public.reward_referral() TO service_role;


--
-- Name: FUNCTION save_push_subscription(p_subscription_object jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.save_push_subscription(p_subscription_object jsonb) TO anon;
GRANT ALL ON FUNCTION public.save_push_subscription(p_subscription_object jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.save_push_subscription(p_subscription_object jsonb) TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION trg_quiz_finished_compute(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_quiz_finished_compute() TO anon;
GRANT ALL ON FUNCTION public.trg_quiz_finished_compute() TO authenticated;
GRANT ALL ON FUNCTION public.trg_quiz_finished_compute() TO service_role;


--
-- Name: FUNCTION trg_quiz_notifications(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_quiz_notifications() TO anon;
GRANT ALL ON FUNCTION public.trg_quiz_notifications() TO authenticated;
GRANT ALL ON FUNCTION public.trg_quiz_notifications() TO service_role;


--
-- Name: FUNCTION trg_tx_sync_profiles(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_tx_sync_profiles() TO anon;
GRANT ALL ON FUNCTION public.trg_tx_sync_profiles() TO authenticated;
GRANT ALL ON FUNCTION public.trg_tx_sync_profiles() TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: FUNCTION update_user_claims(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_user_claims() TO anon;
GRANT ALL ON FUNCTION public.update_user_claims() TO authenticated;
GRANT ALL ON FUNCTION public.update_user_claims() TO service_role;


--
-- Name: FUNCTION apply_rls(wal jsonb, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO anon;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO authenticated;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO service_role;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO supabase_realtime_admin;


--
-- Name: FUNCTION broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO postgres;
GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO dashboard_user;


--
-- Name: FUNCTION build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO postgres;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO anon;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO service_role;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO supabase_realtime_admin;


--
-- Name: FUNCTION "cast"(val text, type_ regtype); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO postgres;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO dashboard_user;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO anon;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO authenticated;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO service_role;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO supabase_realtime_admin;


--
-- Name: FUNCTION check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO postgres;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO anon;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO authenticated;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO service_role;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO supabase_realtime_admin;


--
-- Name: FUNCTION is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO postgres;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO anon;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO service_role;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO supabase_realtime_admin;


--
-- Name: FUNCTION list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO anon;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO authenticated;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO service_role;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO supabase_realtime_admin;


--
-- Name: FUNCTION quote_wal2json(entity regclass); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO postgres;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO anon;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO authenticated;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO service_role;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO supabase_realtime_admin;


--
-- Name: FUNCTION send(payload jsonb, event text, topic text, private boolean); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO postgres;
GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO dashboard_user;


--
-- Name: FUNCTION subscription_check_filters(); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO postgres;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO dashboard_user;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO anon;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO authenticated;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO service_role;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO supabase_realtime_admin;


--
-- Name: FUNCTION to_regrole(role_name text); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO postgres;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO anon;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO authenticated;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO service_role;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO supabase_realtime_admin;


--
-- Name: FUNCTION topic(); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.topic() TO postgres;
GRANT ALL ON FUNCTION realtime.topic() TO dashboard_user;


--
-- Name: FUNCTION _crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea); Type: ACL; Schema: vault; Owner: -
--

GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO service_role;


--
-- Name: FUNCTION create_secret(new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: -
--

GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;


--
-- Name: FUNCTION update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: -
--

GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;


--
-- Name: TABLE audit_log_entries; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.audit_log_entries TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.audit_log_entries TO postgres;
GRANT SELECT ON TABLE auth.audit_log_entries TO postgres WITH GRANT OPTION;


--
-- Name: TABLE flow_state; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.flow_state TO postgres;
GRANT SELECT ON TABLE auth.flow_state TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.flow_state TO dashboard_user;


--
-- Name: TABLE identities; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.identities TO postgres;
GRANT SELECT ON TABLE auth.identities TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.identities TO dashboard_user;


--
-- Name: TABLE instances; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.instances TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.instances TO postgres;
GRANT SELECT ON TABLE auth.instances TO postgres WITH GRANT OPTION;


--
-- Name: TABLE mfa_amr_claims; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_amr_claims TO postgres;
GRANT SELECT ON TABLE auth.mfa_amr_claims TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_amr_claims TO dashboard_user;


--
-- Name: TABLE mfa_challenges; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_challenges TO postgres;
GRANT SELECT ON TABLE auth.mfa_challenges TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_challenges TO dashboard_user;


--
-- Name: TABLE mfa_factors; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_factors TO postgres;
GRANT SELECT ON TABLE auth.mfa_factors TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_factors TO dashboard_user;


--
-- Name: TABLE oauth_clients; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.oauth_clients TO postgres;
GRANT ALL ON TABLE auth.oauth_clients TO dashboard_user;


--
-- Name: TABLE one_time_tokens; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.one_time_tokens TO postgres;
GRANT SELECT ON TABLE auth.one_time_tokens TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.one_time_tokens TO dashboard_user;


--
-- Name: TABLE refresh_tokens; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.refresh_tokens TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.refresh_tokens TO postgres;
GRANT SELECT ON TABLE auth.refresh_tokens TO postgres WITH GRANT OPTION;


--
-- Name: SEQUENCE refresh_tokens_id_seq; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO dashboard_user;
GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO postgres;


--
-- Name: TABLE saml_providers; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_providers TO postgres;
GRANT SELECT ON TABLE auth.saml_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_providers TO dashboard_user;


--
-- Name: TABLE saml_relay_states; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_relay_states TO postgres;
GRANT SELECT ON TABLE auth.saml_relay_states TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_relay_states TO dashboard_user;


--
-- Name: TABLE sessions; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sessions TO postgres;
GRANT SELECT ON TABLE auth.sessions TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sessions TO dashboard_user;


--
-- Name: TABLE sso_domains; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_domains TO postgres;
GRANT SELECT ON TABLE auth.sso_domains TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_domains TO dashboard_user;


--
-- Name: TABLE sso_providers; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_providers TO postgres;
GRANT SELECT ON TABLE auth.sso_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_providers TO dashboard_user;


--
-- Name: TABLE users; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.users TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.users TO postgres;
GRANT SELECT ON TABLE auth.users TO postgres WITH GRANT OPTION;


--
-- Name: TABLE job; Type: ACL; Schema: cron; Owner: -
--

GRANT SELECT ON TABLE cron.job TO postgres WITH GRANT OPTION;


--
-- Name: TABLE job_run_details; Type: ACL; Schema: cron; Owner: -
--

GRANT ALL ON TABLE cron.job_run_details TO postgres WITH GRANT OPTION;


--
-- Name: TABLE daily_streaks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.daily_streaks TO anon;
GRANT ALL ON TABLE public.daily_streaks TO authenticated;
GRANT ALL ON TABLE public.daily_streaks TO service_role;


--
-- Name: TABLE levels; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.levels TO anon;
GRANT ALL ON TABLE public.levels TO authenticated;
GRANT ALL ON TABLE public.levels TO service_role;


--
-- Name: SEQUENCE levels_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.levels_id_seq TO anon;
GRANT ALL ON SEQUENCE public.levels_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.levels_id_seq TO service_role;


--
-- Name: TABLE quiz_participants; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.quiz_participants TO anon;
GRANT ALL ON TABLE public.quiz_participants TO authenticated;
GRANT ALL ON TABLE public.quiz_participants TO service_role;


--
-- Name: TABLE quiz_results; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.quiz_results TO anon;
GRANT ALL ON TABLE public.quiz_results TO authenticated;
GRANT ALL ON TABLE public.quiz_results TO service_role;


--
-- Name: TABLE quizzes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.quizzes TO anon;
GRANT ALL ON TABLE public.quizzes TO authenticated;
GRANT ALL ON TABLE public.quizzes TO service_role;


--
-- Name: TABLE my_quizzes_view; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.my_quizzes_view TO anon;
GRANT ALL ON TABLE public.my_quizzes_view TO authenticated;
GRANT ALL ON TABLE public.my_quizzes_view TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE options; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.options TO anon;
GRANT ALL ON TABLE public.options TO authenticated;
GRANT ALL ON TABLE public.options TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE push_subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.push_subscriptions TO anon;
GRANT ALL ON TABLE public.push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;


--
-- Name: TABLE questions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.questions TO anon;
GRANT ALL ON TABLE public.questions TO authenticated;
GRANT ALL ON TABLE public.questions TO service_role;


--
-- Name: TABLE quiz_prizes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.quiz_prizes TO service_role;


--
-- Name: TABLE redemptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.redemptions TO anon;
GRANT ALL ON TABLE public.redemptions TO authenticated;
GRANT ALL ON TABLE public.redemptions TO service_role;


--
-- Name: TABLE referrals; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.referrals TO anon;
GRANT ALL ON TABLE public.referrals TO authenticated;
GRANT ALL ON TABLE public.referrals TO service_role;


--
-- Name: TABLE reward_catalog; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.reward_catalog TO service_role;
GRANT SELECT ON TABLE public.reward_catalog TO authenticated;


--
-- Name: TABLE transactions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.transactions TO anon;
GRANT ALL ON TABLE public.transactions TO authenticated;
GRANT ALL ON TABLE public.transactions TO service_role;


--
-- Name: TABLE user_answers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_answers TO anon;
GRANT ALL ON TABLE public.user_answers TO authenticated;
GRANT ALL ON TABLE public.user_answers TO service_role;


--
-- Name: TABLE user_quiz_stats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_quiz_stats TO anon;
GRANT ALL ON TABLE public.user_quiz_stats TO authenticated;
GRANT ALL ON TABLE public.user_quiz_stats TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON TABLE realtime.messages TO postgres;
GRANT ALL ON TABLE realtime.messages TO dashboard_user;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO anon;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO service_role;


--
-- Name: TABLE messages_2025_09_08; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON TABLE realtime.messages_2025_09_08 TO postgres;
GRANT ALL ON TABLE realtime.messages_2025_09_08 TO dashboard_user;


--
-- Name: TABLE messages_2025_09_09; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON TABLE realtime.messages_2025_09_09 TO postgres;
GRANT ALL ON TABLE realtime.messages_2025_09_09 TO dashboard_user;


--
-- Name: TABLE messages_2025_09_10; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON TABLE realtime.messages_2025_09_10 TO postgres;
GRANT ALL ON TABLE realtime.messages_2025_09_10 TO dashboard_user;


--
-- Name: TABLE messages_2025_09_11; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON TABLE realtime.messages_2025_09_11 TO postgres;
GRANT ALL ON TABLE realtime.messages_2025_09_11 TO dashboard_user;


--
-- Name: TABLE messages_2025_09_12; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON TABLE realtime.messages_2025_09_12 TO postgres;
GRANT ALL ON TABLE realtime.messages_2025_09_12 TO dashboard_user;


--
-- Name: TABLE messages_2025_09_13; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON TABLE realtime.messages_2025_09_13 TO postgres;
GRANT ALL ON TABLE realtime.messages_2025_09_13 TO dashboard_user;


--
-- Name: TABLE messages_2025_09_14; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON TABLE realtime.messages_2025_09_14 TO postgres;
GRANT ALL ON TABLE realtime.messages_2025_09_14 TO dashboard_user;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON TABLE realtime.schema_migrations TO postgres;
GRANT ALL ON TABLE realtime.schema_migrations TO dashboard_user;
GRANT SELECT ON TABLE realtime.schema_migrations TO anon;
GRANT SELECT ON TABLE realtime.schema_migrations TO authenticated;
GRANT SELECT ON TABLE realtime.schema_migrations TO service_role;
GRANT ALL ON TABLE realtime.schema_migrations TO supabase_realtime_admin;


--
-- Name: TABLE subscription; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON TABLE realtime.subscription TO postgres;
GRANT ALL ON TABLE realtime.subscription TO dashboard_user;
GRANT SELECT ON TABLE realtime.subscription TO anon;
GRANT SELECT ON TABLE realtime.subscription TO authenticated;
GRANT SELECT ON TABLE realtime.subscription TO service_role;
GRANT ALL ON TABLE realtime.subscription TO supabase_realtime_admin;


--
-- Name: SEQUENCE subscription_id_seq; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO postgres;
GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO dashboard_user;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO anon;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO service_role;
GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO supabase_realtime_admin;


--
-- Name: TABLE buckets; Type: ACL; Schema: storage; Owner: -
--

GRANT ALL ON TABLE storage.buckets TO anon;
GRANT ALL ON TABLE storage.buckets TO authenticated;
GRANT ALL ON TABLE storage.buckets TO service_role;
GRANT ALL ON TABLE storage.buckets TO postgres WITH GRANT OPTION;


--
-- Name: TABLE buckets_analytics; Type: ACL; Schema: storage; Owner: -
--

GRANT ALL ON TABLE storage.buckets_analytics TO service_role;
GRANT ALL ON TABLE storage.buckets_analytics TO authenticated;
GRANT ALL ON TABLE storage.buckets_analytics TO anon;


--
-- Name: TABLE objects; Type: ACL; Schema: storage; Owner: -
--

GRANT ALL ON TABLE storage.objects TO anon;
GRANT ALL ON TABLE storage.objects TO authenticated;
GRANT ALL ON TABLE storage.objects TO service_role;
GRANT ALL ON TABLE storage.objects TO postgres WITH GRANT OPTION;


--
-- Name: TABLE prefixes; Type: ACL; Schema: storage; Owner: -
--

GRANT ALL ON TABLE storage.prefixes TO service_role;
GRANT ALL ON TABLE storage.prefixes TO authenticated;
GRANT ALL ON TABLE storage.prefixes TO anon;


--
-- Name: TABLE s3_multipart_uploads; Type: ACL; Schema: storage; Owner: -
--

GRANT ALL ON TABLE storage.s3_multipart_uploads TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO anon;


--
-- Name: TABLE s3_multipart_uploads_parts; Type: ACL; Schema: storage; Owner: -
--

GRANT ALL ON TABLE storage.s3_multipart_uploads_parts TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO anon;


--
-- Name: TABLE secrets; Type: ACL; Schema: vault; Owner: -
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.secrets TO service_role;


--
-- Name: TABLE decrypted_secrets; Type: ACL; Schema: vault; Owner: -
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.decrypted_secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.decrypted_secrets TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: auth; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: auth; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: auth; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: cron; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA cron GRANT ALL ON SEQUENCES TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: cron; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA cron GRANT ALL ON FUNCTIONS TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: cron; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA cron GRANT ALL ON TABLES TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql_public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql_public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql_public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: realtime; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: realtime; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: realtime; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON TABLES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: storage; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: storage; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: storage; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict 57wG27vioxuy89w9D7MQdYj3EMAqqgvFTdSJIKRGpJcc9CDd32wxyUOAQ4WEseU

