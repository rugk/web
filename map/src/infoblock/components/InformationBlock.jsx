import { AppBar, LinearProgress, Box, Typography } from '@mui/material';
import AppContext, {
    isLocalTrack,
    isCloudTrack,
    OBJECT_TYPE_FAVORITE,
    OBJECT_TYPE_WEATHER,
    OBJECT_TYPE_POI,
} from '../../context/AppContext';
import { useState, useContext, useEffect, useCallback, useRef } from 'react';
import { TabContext, TabList } from '@mui/lab';
import TrackTabList from './tabs/TrackTabList';
import WeatherTabList from './tabs/WeatherTabList';
import FavoritesTabList from './tabs/FavoritesTabList';
import _ from 'lodash';
import PoiTabList from './tabs/PoiTabList';
import { hasSegmentTurns } from '../../manager/TracksManager';

const PersistentTabPanel = ({ tabId, selectedTabId, children }) => {
    const [mounted, setMounted] = useState(false);

    if (tabId === selectedTabId || mounted) {
        mounted || setMounted(true);
        const hidden = tabId !== selectedTabId;
        return (
            <Typography hidden={hidden} component="span">
                <Box sx={{ px: 3, pt: 3, pb: 8 }}>{children}</Box>
            </Typography>
        );
    } else {
        // mounted || setTimeout(() => setMounted(true), 1000); // mount not-selected tabs with delay
    }

    return null;
};

export default function InformationBlock({
    mobile,
    infoBlockOpen,
    showInfoBlock,
    setShowInfoBlock,
    setClearState,
    heightScreen,
    resizing,
    setResizing,
    setDrawerHeight,
    drawerHeight,
}) {
    const DRAWER_SIZE = 400;
    const DRAWER_MIN_HEIGHT_OPEN = 50;
    const DRAWER_MAX_HEIGHT_OPEN = 600;

    const ctx = useContext(AppContext);

    const [value, setValue] = useState('general');
    const [tabsObj, setTabsObj] = useState(null);
    const [prevTrack, setPrevTrack] = useState(null);
    const [drawerHeightTemp, setDrawerHeightTemp] = useState(null);
    const [moveEnd, setMoveEnd] = useState(true);

    const moveEndRef = useRef(moveEnd);
    useEffect(() => {
        moveEndRef.current = moveEnd;
    }, [moveEnd]);

    const resizingRef = useRef(resizing);
    useEffect(() => {
        resizingRef.current = resizing;
    }, [resizing]);

    /**
     * Handle Escape key to close PointContextMenu.
     * Located here (parent) to run Effect on closed menu.
     * Otherwise (if located in child) we can't catch removeEventListener moment.
     */
    const escapePointMenu = useCallback((e) => {
        if (e.key === 'Escape') {
            ctx.setPointContextMenu({});
        }
    }, []);
    useEffect(() => {
        window.removeEventListener('keydown', escapePointMenu);
        if (!_.isEmpty(ctx.pointContextMenu)) {
            window.addEventListener('keydown', escapePointMenu);
        }
    }, [ctx.pointContextMenu]);

    function resize(coord, coef) {
        let offsetTop = heightScreen - coord;
        if (offsetTop + coef < DRAWER_MIN_HEIGHT_OPEN) {
            setDrawerHeight(DRAWER_MIN_HEIGHT_OPEN);
        } else if (offsetTop + coef > DRAWER_MAX_HEIGHT_OPEN) {
            setDrawerHeight(DRAWER_MAX_HEIGHT_OPEN);
        } else {
            setDrawerHeight(offsetTop + coef);
        }
    }

    const onMouseUp = useCallback((e) => {
        if (!moveEndRef.current && resizingRef.current) {
            resize(e.clientY, DRAWER_MIN_HEIGHT_OPEN / 2);
            setMoveEnd(true);
            setResizing(false);
        }
    }, []);

    const onMouseMove = useCallback((e) => {
        if (resizingRef.current) {
            resize(e.clientY, DRAWER_MIN_HEIGHT_OPEN / 2);
        }
    }, []);

    useEffect(() => {
        if (resizing && mobile) {
            document.addEventListener('mouseup', onMouseUp, false);
            document.addEventListener('mousemove', onMouseMove, false);
        } else {
            document.removeEventListener('mouseup', onMouseUp, false);
            document.removeEventListener('mousemove', onMouseMove, false);
        }
    }, [resizing, mobile]);

    useEffect(() => {
        if (!showInfoBlock) {
            // stop-editor (close button)
            stopCreatedTrack(false);
            ctx.mutateShowPoints({ points: true, wpts: true });
            ctx.setTrackRange(null);
            setClearState(true);
            ctx.setCurrentObjectType(null);
            if (setDrawerHeight) {
                setDrawerHeight(0);
            }
        }
    }, [showInfoBlock]);

    useEffect(() => {
        const width = getWidth();
        ctx.setInfoBlockWidth(width);
        const px = parseFloat(width) || 0; // 100px -> 100, auto -> 0
        const padding = mobile ? px : px || DRAWER_SIZE + 24; // always apply right padding on desktop
        ctx.mutateFitBoundsPadding((o) => (o.right = padding));
    }, [mobile, showInfoBlock, infoBlockOpen]);

    // detect leaving from Local Track Editor when another kind of object type is activated
    useEffect(() => {
        if (ctx.currentObjectType && isLocalTrack(ctx) === false && ctx.createTrack) {
            stopCreatedTrack(true);
        }
    }, [ctx.currentObjectType]);

    // used to add Turns tab when the turns appeared
    useEffect(() => {
        isLocalTrack(ctx) && ctx.setUpdateInfoBlock(true);
    }, [hasSegmentTurns({ track: ctx.selectedGpxFile })]);

    useEffect(() => {
        if ((!ctx.selectedGpxFile || _.isEmpty(ctx.selectedGpxFile)) && ctx.currentObjectType !== OBJECT_TYPE_WEATHER) {
            setPrevTrack(null);
            setTabsObj(null);
            setShowInfoBlock(false);
        } else {
            if (!ctx.currentObjectType) {
                setTabsObj(null);
                setShowInfoBlock(false);
            } else if (ctx.updateInfoBlock || !prevTrack || Object.keys(prevTrack).length === 0 || !showInfoBlock) {
                let obj;
                setPrevTrack(ctx.selectedGpxFile);
                ctx.setUpdateInfoBlock(false);
                if (isCloudTrack(ctx) && ctx.selectedGpxFile?.tracks) {
                    obj = new TrackTabList().create(ctx, setShowInfoBlock);
                } else if (ctx.currentObjectType === OBJECT_TYPE_WEATHER && ctx.weatherPoint) {
                    obj = new WeatherTabList().create(ctx);
                } else if (ctx.currentObjectType === OBJECT_TYPE_FAVORITE) {
                    obj = new FavoritesTabList().create(ctx);
                } else if (ctx.currentObjectType === OBJECT_TYPE_POI) {
                    obj = new PoiTabList().create();
                } else if (ctx.selectedGpxFile) {
                    // finally assume that default selectedGpxFile is a track
                    obj = new TrackTabList().create(ctx, setShowInfoBlock);
                }
                if (obj) {
                    setShowInfoBlock(true);
                    clearStateIfObjChange();
                    setTabsObj(obj);
                    setValue(obj.defaultTab);
                    if (setDrawerHeight) {
                        setDrawerHeight(50);
                    }
                }
            }
        }
    }, [ctx.currentObjectType, ctx.selectedGpxFile, ctx.weatherPoint, ctx.updateInfoBlock]);

    function clearStateIfObjChange() {
        if (
            prevTrack &&
            prevTrack.name !== ctx.selectedGpxFile.name &&
            prevTrack.points?.length !== ctx.selectedGpxFile?.points?.length
        ) {
            setClearState(true);
        } else {
            setClearState(false);
        }
    }

    function stopCreatedTrack(deletePrev) {
        if (ctx.createTrack) {
            ctx.createTrack.enable = false; // stop-editor
            if (deletePrev) {
                ctx.createTrack.deletePrev = deletePrev;
            }
            ctx.setCreateTrack({ ...ctx.createTrack });
            ctx.addFavorite.editTrack = false;
            ctx.setAddFavorite({ ...ctx.addFavorite });
        }
    }

    function openInfoBlock() {
        return mobile ? true : infoBlockOpen;
    }

    function getWidth() {
        if (showInfoBlock && openInfoBlock()) {
            return mobile ? 'auto' : `${DRAWER_SIZE + 24}px`;
        } else {
            return '0px';
        }
    }

    return (
        <>
            {showInfoBlock && openInfoBlock() && (
                <>
                    <Box anchor={'right'} sx={{ alignContent: 'flex-end', height: 'auto', width: getWidth() }}>
                        <div id="se-infoblock-all">
                            {(ctx.loadingContextMenu || ctx.gpxLoading) && <LinearProgress size={20} />}
                            {tabsObj &&
                                tabsObj.tabList.length > 0 &&
                                (mobile ? (
                                    <TabContext value={value}>
                                        <AppBar position="static" color="default">
                                            <div>
                                                <TabList
                                                    onTouchStart={() => {
                                                        setResizing(true);
                                                    }}
                                                    onTouchEnd={() => {
                                                        setResizing(false);
                                                    }}
                                                    onTouchMove={(e) => {
                                                        if (!resizing) {
                                                            return;
                                                        }
                                                        resize(e.changedTouches[0].clientY, 0);
                                                    }}
                                                    onMouseDown={() => {
                                                        setMoveEnd(false);
                                                        setDrawerHeightTemp(drawerHeight);
                                                        setResizing(true);
                                                    }}
                                                    onMouseUp={() => {
                                                        setResizing(false);
                                                        if (
                                                            drawerHeight === drawerHeightTemp &&
                                                            drawerHeight === DRAWER_MIN_HEIGHT_OPEN
                                                        ) {
                                                            setDrawerHeight(DRAWER_MAX_HEIGHT_OPEN);
                                                        }
                                                    }}
                                                    onMouseMove={(e) => {
                                                        if (!resizing) {
                                                            return;
                                                        }
                                                        resize(e.clientY, DRAWER_MIN_HEIGHT_OPEN / 2);
                                                    }}
                                                    variant="scrollable"
                                                    scrollButtons
                                                    allowScrollButtonsMobile
                                                    onChange={(e, newValue) => setValue(newValue)}
                                                >
                                                    {tabsObj.tabList}
                                                </TabList>
                                            </div>
                                        </AppBar>
                                        <div style={{ height: `${drawerHeight}px`, overflowX: 'auto' }}>
                                            {Object.values(tabsObj.tabs).map((item) => (
                                                <PersistentTabPanel
                                                    key={'tabpanel-mobile:' + item.key}
                                                    sx={{ paddingBottom: '70px' }}
                                                    selectedTabId={value}
                                                    tabId={item.key}
                                                >
                                                    {item}
                                                </PersistentTabPanel>
                                            ))}
                                        </div>
                                    </TabContext>
                                ) : (
                                    <TabContext value={value}>
                                        <AppBar position="static" color="default">
                                            <div>
                                                <TabList
                                                    variant="scrollable"
                                                    scrollButtons
                                                    onChange={(e, newValue) => setValue(newValue)}
                                                >
                                                    {tabsObj.tabList}
                                                </TabList>
                                            </div>
                                        </AppBar>
                                        <div>
                                            {Object.values(tabsObj.tabs).map((item) => (
                                                <PersistentTabPanel
                                                    key={'tabpanel-desktop:' + item.key}
                                                    selectedTabId={value}
                                                    tabId={item.key}
                                                >
                                                    {item}
                                                </PersistentTabPanel>
                                            ))}
                                        </div>
                                    </TabContext>
                                ))}
                        </div>
                    </Box>
                </>
            )}
        </>
    );
}
