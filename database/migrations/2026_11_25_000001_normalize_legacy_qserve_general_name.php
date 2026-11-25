<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

class NormalizeLegacyQserveGeneralName extends Migration
{
    private const DEMO_TENANT_NAME = 'PT PLN (Persero) ULP Subang';

    public function up()
    {
        DB::table('tenants')
            ->where('slug', 'qserve-default')
            ->where('name', 'QServe Default')
            ->update(['name' => self::DEMO_TENANT_NAME]);

        $tenants = DB::table('tenants')->select('id', 'slug', 'name')->get();

        foreach ($tenants as $tenant) {
            $this->replaceLegacyName(
                storage_path('app/settings/tenants/' . $tenant->id . '/general.json'),
                (string) $tenant->name
            );
        }

        $defaultName = (string) ($tenants->firstWhere('slug', 'qserve-default')->name ?? '');
        $this->replaceLegacyName(storage_path('app/settings/general.json'), $defaultName);
    }

    public function down()
    {
        DB::table('tenants')
            ->where('slug', 'qserve-default')
            ->where('name', self::DEMO_TENANT_NAME)
            ->update(['name' => 'QServe Default']);
    }

    private function replaceLegacyName(string $path, string $tenantName): void
    {
        if (!is_file($path)) return;

        $data = json_decode((string) file_get_contents($path), true);
        if (!is_array($data) || ($data['institution_name'] ?? null) !== 'QServe') return;

        $data['institution_name'] = $tenantName;
        file_put_contents($path, json_encode($data));
    }
}
