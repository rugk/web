import React, { useContext, useEffect } from 'react';
import AppContext from '../../../context/AppContext';
import { useMutator } from '../../../util/Utils';
import TracksManager from '../../../manager/track/TracksManager';
import { styled } from '@mui/material/styles';
import { createTrackFreeName, saveTrackToCloud } from '../../../manager/track/SaveTrackManager';
import { FREE_ACCOUNT } from '../../../manager/LoginManager';

export default function CloudGpxUploader({ children, folder = null, style = null }) {
    const ctx = useContext(AppContext);
    const [uploadedFiles, mutateUploadedFiles] = useMutator({});

    function validName(name) {
        return name !== '' && name.trim().length > 0;
    }

    useEffect(() => {
        for (const file in uploadedFiles) {
            let open = uploadedFiles[file].selected;
            let fileName = TracksManager.prepareName(uploadedFiles[file].track.name);
            if (validName(fileName)) {
                fileName = createTrackFreeName(fileName, ctx.tracksGroups, folder);
                saveTrackToCloud(ctx, folder, fileName, 'GPX', uploadedFiles[file].track, open).then();
                mutateUploadedFiles((o) => delete o[file]);
                break; // process 1 file per 1 render
            }
        }
    }, [uploadedFiles]);

    const fileSelected = async (e) => {
        const selected = e.target.files.length === 1;
        ctx.setTrackLoading(Array.from(e.target.files).map((track) => track.name));
        Array.from(e.target.files).forEach((file) => {
            const reader = new FileReader();
            reader.addEventListener('load', async () => {
                const track = await TracksManager.getTrackData(file);
                if (track) {
                    track.name = file.name;
                    mutateUploadedFiles((o) => (o[file.name] = { track, selected }));
                } else {
                    ctx.setTrackErrorMsg({
                        title: 'Import error',
                        msg: `Unable to import ${file.name}`,
                    });
                    ctx.setTrackLoading([...ctx.trackLoading.filter((n) => n !== file.name)]);
                }
            });
            reader.readAsText(file);
        });
    };

    const HiddenInput = styled('input')({ display: 'none' });

    return (
        <label className={style} htmlFor="se-upload-cloud-gpx">
            <HiddenInput
                disabled={ctx.accountInfo?.account === FREE_ACCOUNT}
                id="se-upload-cloud-gpx"
                accept=".gpx"
                multiple
                type="file"
                onChange={fileSelected}
            />
            {children}
        </label>
    );
}
