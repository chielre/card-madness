<template>
    <section v-show="showIntroScreen" ref="introOverlayRef" class="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div ref="introFallRef" class="absolute inset-0 z-0"></div>
        <div ref="introBurstRef" class="absolute inset-0 z-10"></div>
        <div ref="introPacksRef" class="grid grid-cols-4 gap-6 relative z-20">
            <CardPack v-for="pack in introPacks" :pack="pack" :key="pack.id" :selected="false" />
        </div>
    </section>
</template>